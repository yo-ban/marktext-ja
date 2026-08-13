# Linux Installation Instructions

Pre-built MarkText-ja packages are not published yet. Build the application from source by following the [build instructions](../dev/BUILD.md).

Future releases are planned to provide AppImage, deb, rpm, snap, and tar.gz packages named `marktext-ja-linux-<version>.<ext>`.

## Desktop integration

Packaged builds use the `marktext-ja` executable, desktop ID, icon name, and startup window class. A source-built unpacked application can be launched with:

```sh
pnpm start
```

## User data

MarkText-ja stores its Linux profile under `$XDG_CONFIG_HOME/marktext-ja` or `~/.config/marktext-ja`. This is separate from the upstream MarkText profile.

To uninstall an unpacked source build, delete its build output. To remove its settings as well, delete the MarkText-ja [application data directory](APPLICATION_DATA_DIRECTORY.md).
