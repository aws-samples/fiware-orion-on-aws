#!/bin/bash
PROFILE=$1

if [ -z "$1" ]
then
  echo "./deployer.sh <AWS_PROFILE_NAME>";
  exit;
else
  echo "Executing deployer with profile: ${PROFILE}";
fi

INSTALL="npm i"
BOOTSTRAP="npm run cdk bootstrap -- --profile ${PROFILE}"
PROVISION="npm run cdk deploy -- --profile ${PROFILE} --all --outputs-file ./cdk-outputs.json --require-approval never"

$INSTALL
InstallPackagesStatus=$?
[ $InstallPackagesStatus -eq 0 ] && echo "Install packages OK" || exit

$BOOTSTRAP
bootstrap_status=$?
[ $bootstrap_status -eq 0 ] && echo "Bootstrap OK" || exit

$PROVISION
provision_status=$?
[ $provision_status -eq 0 ] && echo "Provisioning AWS OK" || exit
