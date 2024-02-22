// Use a custom uri scheme to store
// vscode does not provide API to modify file content
// so we need to create a virtual file to host replacement preview
// and call the vscode.diff command to display the replacement.
// See relevant comments for TextDocumentContentProvider
// custom scheme comes from https://stackoverflow.com/a/69384899/2198656
import {
  CancellationToken,
  ExtensionContext,
  TextDocument,
  TextDocumentContentProvider,
  Uri,
  workspace,
} from 'vscode'

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

/**
 *  Registration function for preview file provider
 **/
export function registerPreviewProvider({ subscriptions }: ExtensionContext) {
  const previewProvider = new AstGrepPreviewProvider()
  subscriptions.push(
    workspace.registerTextDocumentContentProvider(SCHEME, previewProvider),
    workspace.onDidCloseTextDocument(cleanupDocument),
  )
}

export function generatePreview(
  _file: string,
  _pattern: string,
  _rewrite: string,
) {
  // TODO, maybe we also need a rewrite change event?
  // TODO, implement close preview on new search at first
  // TODO
}