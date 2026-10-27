#!/bin/bash
# Runs once the whole rpm transaction is over. When this package replaces the old "Hodor" one
# (renamed to "hodor"), that package's removal script ran after our install script and took the
# links away: put them back. Harmless on a plain install or upgrade.
if type update-alternatives >/dev/null 2>&1; then
  update-alternatives --install '/usr/bin/hodor-app' 'hodor-app' '/opt/Hodor/hodor-app' 100 || ln -sf '/opt/Hodor/hodor-app' '/usr/bin/hodor-app'
else
  ln -sf '/opt/Hodor/hodor-app' '/usr/bin/hodor-app'
fi
ln -sf '/opt/Hodor/resources/bin/hodor' '/usr/bin/hodor'
exit 0
