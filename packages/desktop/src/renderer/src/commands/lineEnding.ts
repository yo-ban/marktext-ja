import { delay } from '@/util'
import type { EditorState } from '@/store/editor'
import bus from '../bus'
import getCommandDescriptionById from './descriptions'
import { t } from '../i18n'

// Functions, not constants: resolved when the palette opens so they follow
// the current UI language.
const crlfDescription = () => t('commands.file.lineEndingCrlf')
const lfDescription = () => t('commands.file.lineEndingLf')
const markCurrent = (description: string) =>
  t('commands.currentOptionSuffix', { description })

interface LineEndingSubcommand {
  id: string
  description: string
  value: 'crlf' | 'lf'
}

class LineEndingCommand {
  id: string
  description: string
  placeholder: string
  subcommands: LineEndingSubcommand[]
  subcommandSelectedIndex: number
  private _editorState: EditorState

  constructor(editorState: EditorState) {
    this.id = 'file.line-ending'
    this.description = getCommandDescriptionById('file.line-ending')
    this.placeholder = t('commandPalette.placeholders.selectOption')

    this.subcommands = [
      {
        id: 'file.line-ending-crlf',
        description: crlfDescription(),
        value: 'crlf'
      },
      {
        id: 'file.line-ending-lf',
        description: lfDescription(),
        value: 'lf'
      }
    ]
    this.subcommandSelectedIndex = -1

    // Reference to editor state.
    this._editorState = editorState
  }

  run = async(): Promise<void> => {
    const { currentFile } = this._editorState
    if (!currentFile) return
    const { lineEnding } = currentFile
    if (lineEnding === 'crlf') {
      this.subcommandSelectedIndex = 0
      this.subcommands[0].description = markCurrent(crlfDescription())
      this.subcommands[1].description = lfDescription()
    } else {
      this.subcommandSelectedIndex = 1
      this.subcommands[0].description = crlfDescription()
      this.subcommands[1].description = markCurrent(lfDescription())
    }
  }

  execute = async(): Promise<void> => {
    // Timeout to hide the command palette and then show again to prevent issues.
    await delay(100)
    bus.emit('show-command-palette', this)
  }

  executeSubcommand = async(_: string, value: 'crlf' | 'lf'): Promise<void> => {
    bus.emit('mt::set-line-ending', value)
  }

  unload = (): void => {}
}

export default LineEndingCommand
