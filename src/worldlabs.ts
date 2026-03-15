import type {
  WorldLabsGenerateRequest,
  WorldLabsOperation,
  WorldLabsWorld,
} from "./types.js";

const BASE_URL = "https://api.worldlabs.ai";

export class WorldLabsClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        "WLT-Api-Key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`WorldLabs API ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  /**
   * Generate a 3D world from a text prompt.
   */
  async generateWorld(
    displayName: string,
    textPrompt: string,
    model: "Marble 0.1-plus" | "Marble 0.1-mini" = "Marble 0.1-mini"
  ): Promise<WorldLabsOperation> {
    const body: WorldLabsGenerateRequest = {
      display_name: displayName,
      world_prompt: {
        type: "text",
        text_prompt: textPrompt,
      },
      model,
    };
    return this.request<WorldLabsOperation>(
      "POST",
      "/marble/v1/worlds:generate",
      body
    );
  }

  /**
   * Generate from an image URL + optional text prompt.
   */
  async generateWorldFromImage(
    displayName: string,
    imageUri: string,
    textPrompt?: string,
    model: "Marble 0.1-plus" | "Marble 0.1-mini" = "Marble 0.1-mini"
  ): Promise<WorldLabsOperation> {
    const body: WorldLabsGenerateRequest = {
      display_name: displayName,
      world_prompt: {
        type: "image",
        text_prompt: textPrompt,
        image_prompt: {
          source: "uri",
          uri: imageUri,
        },
      },
      model,
    };
    return this.request<WorldLabsOperation>(
      "POST",
      "/marble/v1/worlds:generate",
      body
    );
  }

  /**
   * Poll an operation until done or timeout.
   */
  async pollOperation(
    operationId: string,
    intervalMs = 5000,
    timeoutMs = 600_000
  ): Promise<WorldLabsOperation> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const op = await this.request<WorldLabsOperation>(
        "GET",
        `/marble/v1/operations/${operationId}`
      );
      if (op.done) return op;

      const status = op.metadata?.progress?.description ?? "generating";
      console.log(`  [worldlabs] ${status}...`);
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(`Operation ${operationId} timed out after ${timeoutMs}ms`);
  }

  /**
   * Get full world details by ID.
   */
  async getWorld(worldId: string): Promise<WorldLabsWorld> {
    return this.request<WorldLabsWorld>(
      "GET",
      `/marble/v1/worlds/${worldId}`
    );
  }

  /**
   * Generate a world and wait for completion. Returns world details.
   *
   * The API returns the world data in two places:
   * - operation.response: contains world_id, display_name, assets, world_marble_url, etc.
   * - operation.metadata.world_id: the world ID for separate fetching
   *
   * response uses `world_id` (not `id`) as its identifier field.
   */
  async generateAndWait(
    displayName: string,
    textPrompt: string,
    model: "Marble 0.1-plus" | "Marble 0.1-mini" = "Marble 0.1-mini"
  ): Promise<{
    operation: WorldLabsOperation;
    world: WorldLabsWorld;
  }> {
    const op = await this.generateWorld(displayName, textPrompt, model);
    console.log(`  [worldlabs] generation started: ${op.operation_id}`);

    const completed = await this.pollOperation(op.operation_id);

    if (completed.error) {
      throw new Error(
        `World generation failed: ${completed.error.code} — ${completed.error.message}`
      );
    }

    // The completed operation's `response` field IS the world object.
    // It uses `world_id` as its ID field (not `id`).
    if (completed.response) {
      const world = completed.response;
      // Normalize: ensure `id` is set from `world_id` for downstream code
      if (!world.id && (world as unknown as Record<string, unknown>).world_id) {
        world.id = (world as unknown as Record<string, unknown>).world_id as string;
      }
      return { operation: completed, world };
    }

    // Fallback: fetch via metadata.world_id
    const worldId = completed.metadata?.world_id;
    if (worldId) {
      console.log(`  [worldlabs] fetching world ${worldId}...`);
      const world = await this.getWorld(worldId);
      return { operation: completed, world };
    }

    throw new Error("No world data found in completed operation");
  }
}
