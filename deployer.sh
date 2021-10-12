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
BOOTSTRAP="cdk bootstrap"
PROVISION="cdk deploy --profile ${PROFILE} --all --outputs-file ./cdk-outputs.json"
DOCKER_GENERATOR="node --experimental-json-modules docker/docker-compose-generator.mjs"

$INSTALL
InstallPackagesStatus=$?
[ $InstallPackagesStatus -eq 0 ] && echo "Install packages OK" || exit

$BOOTSTRAP
bootstrap_status=$?
[ $bootstrap_status -eq 0 ] && echo "Bootstrap OK" || exit

$PROVISION
provision_status=$?
[ $provision_status -eq 0 ] && echo "Provisioning AWS OK" || exit

$DOCKER_GENERATOR
generator_status=$?
[ $generator_status -eq 0 ] && echo "Generate docker-compose files OK" || exit
