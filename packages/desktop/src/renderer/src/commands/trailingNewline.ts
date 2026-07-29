import { delay } from '@/util'
import type { EditorState } from '@/store/editor'
import bus from '../bus'
import getCommandDescriptionById from './descriptions'
import { t } from '../i18n'

// Function, not a constant: resolved when the palette opens so the entries
// follow the current UI language.
const descriptions = () => [
  t('commands.file.trailingNewlineTrim'),
  t('commands.file.trailingNewlineSingle'),
  t('commands.file.trailingNewlineDisabled')
]

interface TrailingNewlineSubcommand {
  id: string
  description: string
  value: number
}

class TrailingNewlineCommand {
  id: string
  description: string
  placeholder: string
  subcommands: TrailingNewlineSubcommand[]
  subcommandSelectedIndex: number
  private _editorState: EditorState

  constructor(editorState: EditorState) {
    this.id = 'file.trailing-newline'
    this.description = getCommandDescriptionById('file.trailing-newline')
    this.placeholder = t('commandPalette.placeholders.selectOption')
    this.subcommands = []
    this.subcommandSelectedIndex = -1

    // Reference to editor state.
    this._editorState = editorState
  }

  run = async(): Promise<void> => {
    const { currentFile } = this._editorState
    if (!currentFile) return
    const { trimTrailingNewline } = currentFile
    let index: number = trimTrailingNewline
    if (index !== 0 && index !== 1) {
      index = 2
    }

    const texts = descriptions()
    this.subcommands = [
      {
        id: 'file.trailing-newline-trim',
        description: texts[0],
        value: 0
      },
      {
        id: 'file.trailing-newline-single',
        description: texts[1],
        value: 1
      },
      {
        id: 'file.trailing-newline-disabled',
        description: texts[2],
        value: 3
      }
    ]
    this.subcommands[index].description = t('commands.currentOptionSuffix', {
      description: texts[index]
    })
    this.subcommandSelectedIndex = index
  }

  execute = async(): Promise<void> => {
    // Timeout to hide the command palette and then show again to prevent issues.
    await delay(100)
    bus.emit('show-command-palette', this)
  }

  executeSubcommand = async(_: string, value: number): Promise<void> => {
    bus.emit('mt::set-final-newline', value)
  }

  unload = (): void => {}
}

export default TrailingNewlineCommand
