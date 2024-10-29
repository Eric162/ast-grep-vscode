import { memo, useState } from 'react'
import SearchOptions from './SearchOptions'
import SearchWidget from './SearchWidget'
import BuilderWidget from './BuilderWidget'

function SearchWidgetContainer() {
  const [mode, setMode] = useState('build-yaml')

  return (
    <div style={{ margin: '0 12px 0 2px' }}>
      <div>
        <label htmlFor="mode-select">Mode</label>
        <select
          id="mode-select"
          value={mode}
          onChange={({ target: { value } }) => {
            setMode(value)
          }}
        >
          <option key="search" value="search">
            Search
          </option>
          <option key="yaml" value="yaml">
            YAML
          </option>
          <option key="build-yaml" value="build-yaml">
            Builder
          </option>
        </select>
      </div>
      {mode === 'search' && <SearchWidget />}
      {mode === 'build-yaml' && <BuilderWidget />}
      <SearchOptions />
    </div>
  )
}

export default memo(SearchWidgetContainer)
