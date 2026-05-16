import { createServer, type Server } from "node:http";

const fetchForbiddenPorts = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79,
  87, 95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137,
  139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532,
  540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723,
  2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669,
  6697, 10080
]);

export function isFetchForbiddenPort(port: number): boolean {
  return fetchForbiddenPorts.has(port);
}

export async function findFetchSafePort(): Promise<number> {
  const server = createServer();
  try {
    return await listenOnFetchSafePort(server);
  } finally {
    await closeServer(server);
  }
}

export async function listenOnFetchSafePort(server: Server): Promise<number> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await listenOnRandomLocalPort(server);

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("server did not expose a port");
    }
    if (!isFetchForbiddenPort(address.port)) {
      return address.port;
    }

    await closeServer(server);
  }

  throw new Error("could not find a fetch-safe local port");
}

async function listenOnRandomLocalPort(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      server.off("error", onError);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      cleanup();
      resolve();
    });
  });
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
