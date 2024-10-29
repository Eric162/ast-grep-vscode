import {
  VSCodeButton,
  VSCodeDropdown,
  VSCodeOption,
  VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react'
import { LangSelectBase } from '../LangSelect'
import * as stylex from '@stylexjs/stylex'
import {
  ChangeEvent,
  createContext,
  FormEvent,
  useContext,
  useMemo,
  useState,
} from 'react'
import type {
  NthChild,
  PatternStyle,
  Relation,
  Rule,
} from '@ast-grep/napi/manual'
import { Lang, NapiConfig } from '@ast-grep/napi'

const styles = stylex.create({
  container: {
    position: 'relative',
  },
  replaceToggle: {
    width: 16,
    height: '100%',
    cursor: 'pointer',
    position: 'absolute',
    top: 0,
    left: 0,
    display: 'flex',
    alignItems: 'center',
    ':hover': {
      background: 'var(--vscode-toolbar-hoverBackground)',
    },
  },
  inputs: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginLeft: 18,
    flex: 1,
  },
  replaceToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  replaceAll: {
    height: 24,
    marginRight: -2,
  },
})

type RuleFieldComponentProps<T extends any> = {
  value: T
  onChange: (value: T) => void
}

type RuleFieldComponent = React.ComponentType<RuleFieldComponentProps<any>>

const RuleFieldToComponent = {
  all: ArrayRuleComponent,
  any: ArrayRuleComponent,
  follows: RuleComponent,
  not: RuleComponent,
  has: RuleComponent,
  inside: RuleComponent,
  matches: MatchesComponent,
  nthChild: NthChildComponent,
  pattern: PatternComponent,
  precedes: RuleComponent,

  // string fields
  kind: StringRuleComponent, // TODO: can be a selector/autocomplete if the language is selected
  regex: StringRuleComponent,
} as const satisfies Record<keyof Rule, RuleFieldComponent>
const RULE_FIELDS = Object.keys(
  RuleFieldToComponent,
) as (keyof typeof RuleFieldToComponent)[]

const RelationToComponent = {
  stopBy: StringRuleComponent,
  field: StringRuleComponent,
  ...RuleFieldToComponent,
} as const satisfies Record<keyof Relation, RuleFieldComponent>

function ArrayRuleComponent({
  value,
  onChange,
}: RuleFieldComponentProps<Rule[]>) {
  return (
    <div>
      <ul
        style={{
          listStyleType: 'none',
          padding: 0,
          margin: 0,
        }}
      >
        {value?.map?.((rule, i) => {
          return (
            <li key={i}>
              <RuleComponent
                value={rule}
                onChange={newValue => {
                  const newRules = [...value]
                  if (!newValue) {
                    newRules.splice(i, 1)
                  } else {
                    newRules[i] = newValue
                  }
                  onChange(newRules)
                }}
              />
            </li>
          )
        })}
        {/* TODO add button */}
      </ul>
    </div>
  )
}

function StringRuleComponent({
  value,
  onChange,
}: RuleFieldComponentProps<string | undefined>) {
  return (
    <label>
      <VSCodeTextField
        value={value ?? ''}
        onChange={e =>
          onChange((e as FormEvent<HTMLInputElement>).currentTarget.value)
        }
      />
    </label>
  )
}

/**
 * This context is used to pass the list of utils to the MatchesComponent. This is
 * important so that utils do not reference themselves.
 */
const UtilsContext = createContext<string[]>([])

function MatchesComponent({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const utils = useContext(UtilsContext)

  return (
    <VSCodeDropdown
      value={value}
      onChange={e =>
        onChange((e as FormEvent<HTMLSelectElement>).currentTarget.value)
      }
    >
      {[undefined, ...utils].map(key => (
        <VSCodeOption key={key} value={key}>
          {key}
        </VSCodeOption>
      ))}
    </VSCodeDropdown>
  )
}

function NthChildComponent({
  value,
  onChange,
}: {
  value: NthChild
  onChange: (value: NthChild) => void
}) {
  return <>NthChild Not Implemented.</>
}
function PatternComponent({
  value,
  onChange,
}: {
  value: PatternStyle
  onChange: (value: PatternStyle) => void
}) {
  return <>Pattern Not Implemented.</>
}

interface UtilsFormElements extends HTMLFormControlsCollection {
  name: HTMLInputElement
}
interface UtilsFormElement extends HTMLFormElement {
  readonly elements: UtilsFormElements
}

function UtilityRulesComponent({
  value: utils,
  onChange,
}: {
  value: Record<string, Rule> | undefined
  onChange: (namedUtils: Record<string, Rule>) => void
}) {
  const [isAdding, setIsAdding] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const utilKeys = Object.keys(utils ?? {})

  return (
    <div>
      {utilKeys.map(key => {
        const rule = utils?.[key]
        return (
          <UtilsContext.Provider
            value={utilKeys.filter(utilKey => key !== utilKey)}
          >
            <div style={{ paddingLeft: 4 }} key={key}>
              {isEditing ? (
                <VSCodeTextField
                  value={key}
                  onChange={(e: any) => {
                    const { [key]: _, ...rest } = utils ?? {}
                    onChange({ ...rest, [e.target.value ?? '']: rule })
                    setIsEditing(false)
                  }}
                  onBlur={() => setIsEditing(false)}
                />
              ) : (
                <>
                  <code
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setIsEditing(true)
                    }}
                  >
                    {key}
                  </code>
                  :
                </>
              )}
              <RuleComponent
                value={rule}
                onChange={value => {
                  const { [key]: _, ...rest } = utils ?? {}

                  if (value === undefined) {
                    onChange(rest)
                  } else {
                    onChange({ ...rest, [key]: value })
                  }
                }}
              />
            </div>
          </UtilsContext.Provider>
        )
      })}
      {isAdding && (
        <form
          onSubmit={(e: FormEvent<UtilsFormElement>) => {
            e.preventDefault()
            const name = e.currentTarget.elements.name.value
            if (utilKeys.includes(name)) {
              return
            }

            onChange({ ...utils, [name]: {} })
            setIsAdding(false)
          }}
        >
          <VSCodeTextField name="name" />
          <VSCodeButton type="submit">Add</VSCodeButton>
        </form>
      )}
      <VSCodeButton
        onClick={() => {
          setIsAdding(true)
        }}
      >
        + Add Rule
      </VSCodeButton>
    </div>
  )
}

function RuleComponent({
  value,
  onChange,
}: RuleFieldComponentProps<Rule | undefined>) {
  const [usedKeys, unusedKeys] = useMemo(() => {
    if (!value || Object.keys(value).length === 0) return [[], RULE_FIELDS]
    return [
      Object.keys(value) as typeof RULE_FIELDS,
      RULE_FIELDS.filter(key => !(key in value)),
    ]
  }, [value])

  const onSelectAddKey = (e: any) => {
    const key = e.target.value as keyof Rule
    onChange({ ...(value ?? {}), [key]: undefined })
  }

  return (
    <div style={{ paddingLeft: 4 }}>
      {!!usedKeys.length && (
        <ul style={{ paddingLeft: 8 }}>
          {usedKeys.map(key => {
            const ComponentForRuleField =
              RelationToComponent[key as keyof typeof RelationToComponent]
            return (
              <li>
                <code>{key}</code>
                <ComponentForRuleField
                  value={value?.[key]}
                  onChange={(newValue: any) =>
                    onChange({ ...value, [key]: newValue })
                  }
                />
              </li>
            )
          })}
        </ul>
      )}
      {!!unusedKeys.length && (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          +{' '}
          <VSCodeDropdown value={undefined} onChange={onSelectAddKey}>
            {[undefined, ...unusedKeys].map(key => (
              <VSCodeOption key={key} value={key}>
                {key}
              </VSCodeOption>
            ))}
          </VSCodeDropdown>
        </div>
      )}
    </div>
  )
}

function BuilderWidgetContainer() {
  const [config, setConfig] = useState<NapiConfig>({
    rule: {},
  })

  const onChangeLang = (e: ChangeEvent<HTMLSelectElement>) => {
    setConfig(prev => ({ ...prev, language: e.target.value as Lang }))
  }

  const onChangeUtils = (utils: Record<string, Rule>) => {
    setConfig(prev => {
      if (Object.keys(utils).length === 0) {
        const { utils: _, ...rest } = prev
        return { ...rest }
      }
      return { ...prev, utils }
    })
  }

  const onChangeRule = (rule: Rule | undefined) => {
    setConfig(prev => ({ ...prev, rule }))
  }

  return (
    <div {...stylex.props(styles.container)}>
      <h1>BUILDER</h1>
      <label
        htmlFor="lang-select"
        style={{ position: 'relative', display: 'flex' }}
      >
        Select Language:
        <LangSelectBase onChange={onChangeLang} value={config.language ?? ''} />
      </label>
      <label htmlFor="utils">
        Utils:
        <UtilityRulesComponent value={config.utils} onChange={onChangeUtils} />
      </label>
      <UtilsContext.Provider value={Object.keys(config.utils ?? [])}>
        <label htmlFor="rule">
          Rule:
          <RuleComponent value={config.rule} onChange={onChangeRule} />
        </label>
      </UtilsContext.Provider>
    </div>
  )
}

export default BuilderWidgetContainer
