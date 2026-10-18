export const MODULE_ID = "talking-tokens";

/** Foundry routes a module socket message only if module.json has "socket": true. */
export const SOCKET_NAME = `module.${MODULE_ID}`;

export const TEMPLATE_PATH = `modules/${MODULE_ID}/templates`;
