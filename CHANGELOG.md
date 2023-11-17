# Changelog

## Update 2023-Nov

- Removed ECS docker integration. CDK will deploy ECS containers for Orion and Cygnus under one ECS cluster in the Fiware stack.
- Fixed engine deployment of Aurora Serverless V1.
- Cygnus internal endpoint changed from `<http://cygnus.cygnus.local:5055/notify>` to `<http://cygnus.fiware:5055/notify>`
- Add a simple settings.ts file to edit options for deployment.
