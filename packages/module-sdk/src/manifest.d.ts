export type ModuleId = 'core' | 'crm' | 'pos' | 'inventory' | 'products' | 'finance' | 'operations' | 'pricing' | 'analytics' | 'branding' | 'ai';
export interface ModuleManifest {
    id: ModuleId;
    name: string;
    description: string;
    version: string;
    alwaysOn: boolean;
    dependencies: ModuleId[];
    defaultEnabled: boolean;
    requiredRoles?: string[];
}
export interface FeatureFlag {
    moduleId: ModuleId;
    tenantId: string;
    enabled: boolean;
    enabledForRoles?: string[];
    enabledForUsers?: string[];
    metadata?: Record<string, unknown>;
}
export interface ToggleResolution {
    moduleId: ModuleId;
    enabled: boolean;
    resolvedAt: 'user' | 'role' | 'tenant' | 'default';
}
export declare const MODULE_MANIFESTS: Record<ModuleId, ModuleManifest>;
//# sourceMappingURL=manifest.d.ts.map