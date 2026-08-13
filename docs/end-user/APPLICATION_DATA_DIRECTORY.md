# Application Data Directory

The per-user application data directory is located in the following directory:

- `%APPDATA%\marktext-ja` on Windows
- `$XDG_CONFIG_HOME/marktext-ja` or `~/.config/marktext-ja` on Linux
- `~/Library/Application Support/marktext-ja` on macOS

When [portable mode](PORTABLE.md) is enabled, the directory location is either the `--user-data-dir` parameter or `marktext-ja-user-data` directory.
