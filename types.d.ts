interface Aurora {
  dbusername: string;
}

interface Fiware {
  orion: {
    memoryLimitMiB?: number;
    cpu?: number;
    desiredCount?: number;
    ddbInstances?: number;
    ddbuser?: string;
    orionLD?: boolean;
  };
  cygnus?: {
    aurora: Aurora;
    memoryLimitMiB?: number;
    cpu?: number;
    desiredCount?: number;
  };
}

export interface Settings {
  region?: string;
  allowedIps?: Array<string>;
  fiware: Fiware;
  dockerHub?: {
    username: string;
    password: string;
  };
}
