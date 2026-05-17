import type { DiagnosticMessage } from "./diagnosticsService.js";
import type {
  DocumentState,
  DocumentStateService,
} from "./documentStateService.js";
import type { ThemeResolution } from "./themeResolver.js";
import type {
  ThemePackage,
  TransformRequest,
  TransformResponse,
} from "./transformService.js";
import type { WorkspaceTrustService } from "./workspaceTrustService.js";

const DEFAULT_THEME_ID = "default";
const TRANSFORM_OPTIONS = {
  allowRawHtml: false,
} as const;

export interface DocumentTransformThemeResolver {
  resolveTheme(
    themeId: string,
    options: { isWorkspaceTrusted: boolean },
  ): Promise<ThemeResolution>;
}

export interface DocumentTransformServiceLike {
  transform(request: TransformRequest): Promise<TransformResponse>;
}

export class DocumentTransformService {
  #refreshSequence = 0;

  public constructor(
    private readonly documentStateService: DocumentStateService,
    private readonly themeResolver: DocumentTransformThemeResolver,
    private readonly transformService: DocumentTransformServiceLike,
    private readonly workspaceTrustService: WorkspaceTrustService,
  ) {}

  public async refreshActiveDocument(): Promise<DocumentState> {
    const state = this.documentStateService.getState();
    if (
      state.status !== "active" ||
      state.uri === undefined ||
      state.markdown === undefined
    ) {
      return state;
    }

    const source = {
      markdown: state.markdown,
      uri: state.uri,
    };
    const refreshSequence = ++this.#refreshSequence;
    const defaultThemeId = readThemeId(state.currentTheme) ?? DEFAULT_THEME_ID;
    const candidateThemeIds = uniqueThemeIds([
      defaultThemeId,
      DEFAULT_THEME_ID,
    ]);
    const resolutions = new Map<string, ThemeResolution>();
    await this.resolveThemeCandidates(candidateThemeIds, resolutions);

    let result = await this.transformWithThemeCandidates(
      source.markdown,
      defaultThemeId,
      candidateThemeIds,
      resolutions,
    );
    const frontmatterThemeId = readThemeId(result.frontmatter?.theme);

    if (
      frontmatterThemeId !== undefined &&
      !candidateThemeIds.includes(frontmatterThemeId)
    ) {
      const nextCandidateThemeIds = uniqueThemeIds([
        frontmatterThemeId,
        ...candidateThemeIds,
      ]);
      await this.resolveThemeCandidates([frontmatterThemeId], resolutions);
      result = await this.transformWithThemeCandidates(
        source.markdown,
        defaultThemeId,
        nextCandidateThemeIds,
        resolutions,
      );
    }

    if (
      refreshSequence !== this.#refreshSequence ||
      !this.isCurrentSource(source)
    ) {
      return this.documentStateService.getState();
    }

    const diagnostics = collectResolutionDiagnostics(resolutions, {
      defaultThemeId,
      requestedThemeId: frontmatterThemeId,
      resolvedThemeId: result.resolvedThemeId,
    });
    const resolvedTheme = resolutions.get(result.resolvedThemeId)?.theme;
    return this.documentStateService.applyTransformResult(result, {
      diagnostics,
      expectedUri: source.uri,
      themeFiles: resolvedTheme?.files ?? [],
    });
  }

  private async resolveThemeCandidates(
    themeIds: readonly string[],
    resolutions: Map<string, ThemeResolution>,
  ): Promise<void> {
    for (const themeId of themeIds) {
      if (resolutions.has(themeId)) {
        continue;
      }

      resolutions.set(
        themeId,
        await this.themeResolver.resolveTheme(themeId, {
          isWorkspaceTrusted: this.workspaceTrustService.isTrusted,
        }),
      );
    }
  }

  private async transformWithThemeCandidates(
    markdown: string,
    defaultThemeId: string,
    themeIds: readonly string[],
    resolutions: ReadonlyMap<string, ThemeResolution>,
  ): Promise<TransformResponse> {
    return this.transformService.transform({
      defaultThemeId,
      markdown,
      options: TRANSFORM_OPTIONS,
      themes: createThemePackages(themeIds, resolutions),
    });
  }

  private isCurrentSource(source: { markdown: string; uri: string }): boolean {
    const state = this.documentStateService.getState();
    return (
      state.status === "active" &&
      state.uri === source.uri &&
      state.markdown === source.markdown
    );
  }
}

function createThemePackages(
  themeIds: readonly string[],
  resolutions: ReadonlyMap<string, ThemeResolution>,
): ThemePackage[] {
  const themes: ThemePackage[] = [];
  const seenThemeIds = new Set<string>();
  for (const themeId of themeIds) {
    const themePackage = resolutions.get(themeId)?.theme?.themePackage;
    if (themePackage === undefined || seenThemeIds.has(themePackage.id)) {
      continue;
    }

    themes.push(themePackage);
    seenThemeIds.add(themePackage.id);
  }

  return themes;
}

function collectResolutionDiagnostics(
  resolutions: ReadonlyMap<string, ThemeResolution>,
  options: {
    defaultThemeId: string;
    requestedThemeId?: string;
    resolvedThemeId: string;
  },
): DiagnosticMessage[] {
  const diagnosticThemeIds =
    options.requestedThemeId === undefined
      ? [options.defaultThemeId, options.resolvedThemeId, DEFAULT_THEME_ID]
      : [options.requestedThemeId, options.resolvedThemeId, DEFAULT_THEME_ID];
  const diagnostics: DiagnosticMessage[] = [];
  const seenDiagnostics = new Set<string>();

  for (const themeId of uniqueThemeIds(diagnosticThemeIds)) {
    for (const diagnostic of resolutions.get(themeId)?.diagnostics ?? []) {
      const diagnosticKey = `${diagnostic.source}:${diagnostic.message}`;
      if (seenDiagnostics.has(diagnosticKey)) {
        continue;
      }

      diagnostics.push(diagnostic);
      seenDiagnostics.add(diagnosticKey);
    }
  }

  return diagnostics;
}

function uniqueThemeIds(themeIds: readonly string[]): string[] {
  const seenThemeIds = new Set<string>();
  const uniqueIds: string[] = [];
  for (const themeId of themeIds) {
    if (themeId.length === 0 || seenThemeIds.has(themeId)) {
      continue;
    }

    uniqueIds.push(themeId);
    seenThemeIds.add(themeId);
  }

  return uniqueIds;
}

function readThemeId(themeId: string | undefined): string | undefined {
  if (themeId === undefined || themeId.length === 0) {
    return undefined;
  }

  return themeId;
}
