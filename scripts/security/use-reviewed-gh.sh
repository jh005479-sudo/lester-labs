#!/usr/bin/env bash

# Source this file from a GitHub Actions shell step before using `gh`.
if test "${BASH_SOURCE[0]}" = "$0"; then
  echo "use-reviewed-gh.sh must be sourced so the pinned binary replaces PATH in the current step." >&2
  exit 64
fi

reviewed_gh_version="2.96.0"
reviewed_gh_archive_name="gh_${reviewed_gh_version}_linux_amd64.tar.gz"
reviewed_gh_archive_sha256="83d5c2ccad5498f58bf6368acb1ab32588cf43ab3a4b1c301bf36328b1c8bd60"
reviewed_gh_binary_sha256="56b8bbbb27b066ecb33dbef9a256dc9d1314adaeff0908a752feba6c34053b40"
reviewed_gh_root="${RUNNER_TEMP:?RUNNER_TEMP is required}/reviewed-gh-${reviewed_gh_version}"
reviewed_gh_archive="$reviewed_gh_root/$reviewed_gh_archive_name"
reviewed_gh_binary="$reviewed_gh_root/bin/gh"

if ! test -x "$reviewed_gh_binary"; then
  test "$(uname -s)" = "Linux"
  test "$(uname -m)" = "x86_64"
  mkdir -p -- "$reviewed_gh_root/bin"
  curl --disable --proto '=https' --tlsv1.2 --fail --silent --show-error --location \
    --retry 3 --retry-all-errors --connect-timeout 20 --max-time 180 \
    --output "$reviewed_gh_archive.partial" \
    "https://github.com/cli/cli/releases/download/v${reviewed_gh_version}/${reviewed_gh_archive_name}"
  mv -- "$reviewed_gh_archive.partial" "$reviewed_gh_archive"
  printf '%s  %s\n' "$reviewed_gh_archive_sha256" "$reviewed_gh_archive" | sha256sum --check --strict -
  tar --extract --gzip --file "$reviewed_gh_archive" --directory "$reviewed_gh_root/bin" \
    --strip-components=2 --no-same-owner --no-same-permissions \
    "gh_${reviewed_gh_version}_linux_amd64/bin/gh"
  test -f "$reviewed_gh_binary"
  test ! -L "$reviewed_gh_binary"
  chmod 0755 -- "$reviewed_gh_binary"
fi

printf '%s  %s\n' "$reviewed_gh_binary_sha256" "$reviewed_gh_binary" | sha256sum --check --strict -

export PATH="$reviewed_gh_root/bin:$PATH"
test "$(command -v gh)" = "$reviewed_gh_binary"
test "$(gh version | head -n 1 | cut -d' ' -f3)" = "$reviewed_gh_version"

unset reviewed_gh_version reviewed_gh_archive_name reviewed_gh_archive_sha256 reviewed_gh_binary_sha256
unset reviewed_gh_root reviewed_gh_archive reviewed_gh_binary
