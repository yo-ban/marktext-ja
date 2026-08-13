# Installation

MarkText-ja is a free, open-source Markdown editor for **Linux**, **macOS** and **Windows**.

> [!IMPORTANT]
> Pre-built MarkText-ja binaries are not published yet. For now, use the [build instructions](../dev/BUILD.md). The artifact names below describe the packages planned for a future release.

## Windows

| Artifact | When to choose |
| --- | --- |
| `marktext-ja-win-x64-<version>-setup.exe` | Recommended. NSIS installer; per-user install, lets you pick the install directory, creates Start Menu and Desktop shortcuts. |
| `marktext-ja-win-x64-<version>.zip` | Portable zip. Extract anywhere and run `marktext-ja.exe`. See [Portable mode](PORTABLE.md) for details on keeping your data alongside the app. |

The installer asks before registering MarkText-ja as a handler for Markdown files.

## macOS

| Artifact | When to choose |
| --- | --- |
| `marktext-ja-mac-arm64-<version>.dmg` | Apple Silicon. |
| `marktext-ja-mac-x64-<version>.dmg` | Intel Macs. |
| `marktext-ja-mac-<arch>-<version>.zip` | Plain zip alternative to the DMG. |

Open the DMG and drag MarkText-ja into your **Applications** folder. Builds are not currently notarized, so the first launch may prompt the system Gatekeeper — right-click the app and choose **Open** to accept it once.

## Linux

MarkText-ja is planned in five Linux formats. Most users will want the AppImage.

| Artifact | When to choose |
| --- | --- |
| `marktext-ja-linux-<version>.AppImage` | Recommended. Runs on most distros without root. `chmod +x` and double-click (or run directly). |
| `marktext-ja-linux-<version>.deb` | Debian, Ubuntu, Linux Mint, Pop!_OS, … (`sudo apt install ./marktext-ja-linux-<version>.deb`). |
| `marktext-ja-linux-<version>.rpm` | Fedora, RHEL, openSUSE, … (`sudo rpm -i marktext-ja-linux-<version>.rpm`). |
| `marktext-ja-linux-<version>.snap` | Ubuntu / any snap-enabled distro (`sudo snap install marktext-ja-linux-<version>.snap --dangerous --classic`). |
| `marktext-ja-linux-<version>.tar.gz` | Portable tarball. Extract and run the included `marktext-ja` binary. |

> [!NOTE]
> See [Linux notes](LINUX.md) for distro-specific tips (sandbox flags, font configuration, file-association quirks).

## Verify the download

Every release contains a `latest-<platform>.yml` file with SHA-512 hashes. To verify:

```sh
# Example on macOS / Linux
shasum -a 512 marktext-ja-linux-<version>.AppImage
```

Compare the value to the entry in `latest-linux.yml` on the release page.

## Build from source

If you'd rather build from source — for example to track `develop`, to run on an architecture we don't publish a binary for, or to contribute — see the [Build instructions](../dev/BUILD.md) in the developer docs. A minimal recap:

```sh
git clone https://github.com/yo-ban/marktext-ja.git
cd marktext-ja
pnpm install
pnpm run build
```

Output installers land in the repository's `dist/` folder.

## Updating

After public releases begin, packaged MarkText-ja installers will check the MarkText-ja repository for updates. Development and portable builds do not auto-update.

Portable installs and the AppImage do not auto-update — re-download the latest artifact when you want to upgrade.

## Uninstall

| Platform | How |
| --- | --- |
| Windows | **Settings → Apps**, or run the bundled `Uninstall MarkText-ja.exe`. |
| macOS | Drag **MarkText-ja.app** to the Trash. Optionally also remove `~/Library/Application Support/marktext-ja`. |
| Linux (.deb) | `sudo apt remove marktext-ja` |
| Linux (.rpm) | `sudo rpm -e marktext-ja` |
| Linux (snap) | `sudo snap remove marktext-ja` |
| Linux (AppImage / tar.gz) | Delete the file you extracted. |

To wipe MarkText-ja's user data as well, remove its [application data directory](APPLICATION_DATA_DIRECTORY.md).
