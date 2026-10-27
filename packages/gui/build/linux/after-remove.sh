#!/bin/bash

# Hodor: upgrades run this script too, and with rpm they run it after the new version's install
# script, so removing anything here would take the new links away. $1 is the number of instances
# left for rpm (1 on upgrade) and "upgrade" for deb: only a real removal goes on.
case "$1" in
  1 | 2 | upgrade | failed-upgrade) exit 0 ;;
esac

# Delete the link to the binary
# update-alternatives --remove <name> <path>: 'path' must be the registered alternative binary,
# not the generic symlink — see https://man7.org/linux/man-pages/man1/update-alternatives.1.html
if type update-alternatives >/dev/null 2>&1; then
    update-alternatives --remove '${executable}' '/opt/${sanitizedProductName}/${executable}'
else
    rm -f '/usr/bin/${executable}'
fi

APPARMOR_PROFILE_DEST='/etc/apparmor.d/${executable}'

# Remove and unload apparmor profile.
if [ -f "$APPARMOR_PROFILE_DEST" ]; then
  # Unload the profile from the running kernel before deleting the file so the
  # policy is not left enforced until the next reboot.  Mirror the chroot guard
  # used in the after-install script — live AppArmor operations are not
  # meaningful inside a chroot.
  # https://wiki.debian.org/AppArmor/HowToUse
  if apparmor_status --enabled > /dev/null 2>&1; then
    if ! { [ -x '/usr/bin/ischroot' ] && /usr/bin/ischroot; } && hash apparmor_parser 2>/dev/null; then
      apparmor_parser --remove "$APPARMOR_PROFILE_DEST" || true
    fi
  fi
  rm -f "$APPARMOR_PROFILE_DEST"
fi

# Hodor: remove the CLI link (only if it still points to us)
if [ "$(readlink /usr/bin/hodor)" = '/opt/${sanitizedProductName}/resources/bin/hodor' ]; then
  rm -f /usr/bin/hodor
fi

# Hodor: refresh the icon cache so desktops that use it see the new icons
if hash gtk-update-icon-cache 2>/dev/null; then
    gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor || true
fi
