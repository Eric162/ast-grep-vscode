// Use a custom uri scheme to store
// vscode does not provide API to modify file content
// so we need to create a virtual file to host replacement preview
// and call the vscode.diff command to display the replacement.
// See relevant comments for TextDocumentContentProvider
// custom scheme comes from https://stackoverflow.com/a/69384899/2198656
import {
  CancellationToken,
  ExtensionContext,
  Position,
  Range,
  TextDocument,
  TextDocumentContentProvider,
  Uri,
  commands,
  window,
  workspace,
} from 'vscode'
import type { ChildToParent, SgSearch } from '../types'
import { parentPort, streamedPromise } from './common'
import { buildCommand } from './search'

const SCHEME = 'sgpreview'

/**
 * NB A file will only have one preview at a time
 * last rewrite will replace older rewrites
 * key: path, value: string content
 **/
const previewContents: Map<string, string> = new Map()

class AstGrepPreviewProvider implements TextDocumentContentProvider {
  // TODO: add cancellation
  provideTextDocumentContent(uri: Uri, _token: CancellationToken): string {
    return previewContents.get(uri.path) || ''
  }
}

function isSgPreviewUri(uri: Uri) {
  return uri.scheme === SCHEME
}

function cleanupDocument(doc: TextDocument) {
  const uri = doc.uri
  if (!isSgPreviewUri(uri)) {
    return
  }
  previewContents.delete(uri.path)
}

function openFile({ filePath, locationsToSelect }: ChildToParent['openFile']) {
  const uris = workspace.workspaceFolders
  const { joinPath } = Uri

  if (!uris?.length) {
    return
  }

  const fileUri: Uri = joinPath(uris?.[0].uri, filePath)
  let range: undefined | Range
  if (locationsToSelect) {
    const { start, end } = locationsToSelect
    range = new Range(
      new Position(start.line, start.column),
      new Position(end.line, end.column),
    )
  }
  commands.executeCommand('vscode.open', fileUri, {
    selection: range,
  })
}

async function previewDiff({
  filePath,
  locationsToSelect,
  inputValue,
  rewrite,
}: ChildToParent['previewDiff']) {
  const uris = workspace.workspaceFolders
  const { joinPath } = Uri
  if (!uris?.length) {
    return
  }
  const fileUri = joinPath(uris?.[0].uri, filePath)
  await generatePreview(fileUri, inputValue, rewrite)
  const previewUri = fileUri.with({ scheme: SCHEME })
  await commands.executeCommand('vscode.diff', fileUri, previewUri)
  if (locationsToSelect) {
    const { start, end } = locationsToSelect
    const range = new Range(
      new Position(start.line, start.column),
      new Position(end.line, end.column),
    )
    window.activeTextEditor?.revealRange(range)
  }
}
parentPort.onMessage('openFile', openFile)
parentPort.onMessage('previewDiff', previewDiff)

/**
 *  set up replace preview and open file
 **/
export function activatePreview({ subscriptions }: ExtensionContext) {
  const previewProvider = new AstGrepPreviewProvider()

  subscriptions.push(
    workspace.registerTextDocumentContentProvider(SCHEME, previewProvider),
    workspace.onDidCloseTextDocument(cleanupDocument),
  )
}

interface ReplaceArg {
  bytes: Uint8Array
  uri: Uri
  inputValue: string
  rewrite: string
}

async function haveReplace({ bytes, uri, inputValue, rewrite }: ReplaceArg) {
  const command = buildCommand({
    inputValue: inputValue,
    rewrite: rewrite,
    includeFile: uri.fsPath,
  })
  let newBuffer = new Uint8Array(bytes.byteLength)
  let srcOffset = 0
  let destOffset = 0
  function resizeBuffer() {
    let newNewBuffer = new Uint8Array(newBuffer.byteLength * 2)
    newNewBuffer.set(newBuffer)
    newBuffer = newNewBuffer
  }
  const encoder = new TextEncoder()
  await streamedPromise(command!, (results: SgSearch[]) => {
    for (const r of results) {
      // skip overlapping replacement
      if (r.range.byteOffset.start < srcOffset) {
        continue
      }
      const slice = bytes.slice(srcOffset, r.range.byteOffset.start)
      const replacement = encoder.encode(r.replacement!)
      const expectedLength =
        destOffset + slice.byteLength + replacement.byteLength
      while (expectedLength > newBuffer.byteLength) {
        resizeBuffer()
      }
      newBuffer.set(slice, destOffset)
      destOffset += slice.byteLength
      newBuffer.set(replacement, destOffset)
      destOffset += replacement.byteLength
      srcOffset = r.range.byteOffset.end
    }
  })
  const slice = bytes.slice(srcOffset, bytes.byteLength)
  while (destOffset + slice.byteLength > newBuffer.byteLength) {
    resizeBuffer()
  }
  newBuffer.set(slice, destOffset)
  const final = newBuffer.slice(0, destOffset + slice.byteLength)
  return new TextDecoder('utf-8').decode(final)
}

async function generatePreview(uri: Uri, inputValue: string, rewrite: string) {
  if (previewContents.has(uri.path)) {
    return
  }
  // TODO, maybe we also need a rewrite change event?
  // TODO, implement close preview on new search at first
  const bytes = await workspace.fs.readFile(uri)
  const replaced = await haveReplace({
    bytes,
    uri,
    inputValue,
    rewrite,
  })
  previewContents.set(uri.path, replaced)
}
