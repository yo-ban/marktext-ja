// Pairs the file-icons rule database with its stylesheet so a single dynamic
// import of this module pulls both out of the startup bundle.
import '@marktext/file-icons/build/index.css'
import fileIcons from '@marktext/file-icons'

export default fileIcons
