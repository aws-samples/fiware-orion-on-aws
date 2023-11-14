import { Settings } from "./types";

export const settings: Settings = {
  region: "ap-northeast-1", // optional, defaults to your env or aws config
  allowedIps: ["127.0.0.1/32"], // Array of CIDR address to allow access
  fiware: {
    orion: {
      orionLD: false, //use fiware/orion or fiware/orion-ld image
      ddbuser: "awsdemo",
      cpu: 1024,
      memoryLimitMiB: 2048,
      desiredCount: 1, // The initial number of instantiations of the task definition. Auto-scaling is enabled via CPU metric
    },
    cygnus: {
      aurora: {
        dbusername: "postgres",
      },
      cpu: 1024,
      memoryLimitMiB: 2048,
      desiredCount: 1,
    },
  },
};
