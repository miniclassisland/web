/* ===== TypeScript 类型定义 ===== */
/* 对应后端 OpenAPI Schema + ClassIsland 上游数据模型 */

// ============================================================
// 认证相关
// ============================================================

export interface UserRegisterRequest {
    email: string;
    password: string;
    username?: string;
    display_name?: string;
    cf_turnstile_response?: string;
}

export interface UserLoginRequest {
    email: string;
    password: string;
    cf_turnstile_response?: string;
}

export interface EmailAvailabilityRequest {
    email: string;
    cf_turnstile_response?: string;
}

export interface TokenResponse {
    token: string;
    user_id?: string;
    expires_in?: number;
    token_type?: string;
    remaining_recovery_codes?: number;
    require_totp_reset?: boolean;
}

export interface MessageResponse {
    status: string;
    message: string;
}

export interface StatusResponse {
    status: string;
    message?: string;
}

// ============================================================
// 用户、账户
// ============================================================

export interface UserOut {
    id: string;
    username: string;
    email: string;
    display_name: string;
    role_code: string;
    is_active: boolean;
    can_create_account?: boolean;
    totp_enabled?: boolean;
    created_at: string;
}

export interface UserUpdateRequest {
    display_name?: string | null;
    username?: string | null;
    email?: string | null;
    role_code?: string | null;
    is_active?: boolean | null;
    can_create_account?: boolean | null;
    totp_enabled?: boolean | null;
}

export interface EmailUpdate {
    email: string;
}

export interface UsernameUpdate {
    username: string;
}

export interface DisplayNameUpdate {
    display_name: string;
}

export interface PasswordChange {
    old_password: string;
    new_password: string;
}

export type RegistrationMode = "open" | "pairing" | "pre_reg";

export const REGISTRATION_MODE_LABELS: Record<RegistrationMode, string> = {
    open: "开放接入 (无需配对与白名单)",
    pairing: "配对码审批接入 (需管理员审批)",
    pre_reg: "预注册白名单接入 (仅限已登记设备)",
};

export interface AccountOut {
    id: string;
    name: string;
    slug: string;
    api_key: string;
    is_active: boolean;
    registration_mode?: RegistrationMode;
    created_at: string;
}

export interface AccountCreate {
    name: string;
    slug?: string;
    registration_mode?: RegistrationMode;
}

export interface AccountIdUpdate {
    new_id: string;
}

export interface SlugUpdate {
    slug: string;
}

export interface AccountNameUpdate {
    name: string;
    registration_mode?: RegistrationMode;
}

export interface AccountInfoUpdate {
    new_id?: string;
    name?: string;
    slug?: string;
    is_active?: boolean;
    registration_mode?: RegistrationMode;
}

export interface QuotaOut {
    id: string;
    account_id: string;
    quota_key: string;
    max_value: number;
    current_value: number;
}

export interface QuotaSetRequest {
    quota_key: string;
    max_value: number;
}

export const QUOTA_META: Record<string, { label: string; hint: string; type: "number" | "boolean"; defaultMax: number }> = {
    max_clients: {
        label: "允许注册的设备数 (max_clients)",
        hint: "该账户允许登记注册的最大终端设备数量 (默认 6 台，-1 表示不限制)",
        type: "number",
        defaultMax: 6,
    },
    max_grpc_connections: {
        label: "允许 gRPC 长连接的设备数量 (max_grpc_connections)",
        hint: "该账户允许同时建立 gRPC 实时双向长连接会话的最大在线终端数量 (默认 4 个，-1 表示不限制)",
        type: "number",
        defaultMax: 4,
    },
    max_bandwidth_mb: {
        label: "月度流量配额 (MB)",
        hint: "该账户允许的最大配置与资源分发流量 (默认 100 MB，-1 表示不限制)",
        type: "number",
        defaultMax: 100,
    },
    "feature.ota": {
        label: "OTA 策略与组件分发",
        hint: "允许该账户使用远程组件与策略分发能力 (1=开启, 0=关闭)",
        type: "boolean",
        defaultMax: 1,
    },
    "feature.audit": {
        label: "终端安全审计日志",
        hint: "允许该账户收集并检索客户端事件审计日志 (1=开启, 0=关闭)",
        type: "boolean",
        defaultMax: 1,
    },
};

// ============================================================
// 2FA
// ============================================================

export interface TotpEnableResponse {
    secret: string;
    uri: string;
    recovery_codes: string[];
}

export interface TotpConfirmRequest {
    code: string;
}

export interface TotpDisableRequest {
    password?: string;
    totp_code?: string;
    recovery_code?: string;
    second_recovery_code?: string;
    recovery_codes?: string[];
}

export interface TotpVerifyRequest {
    temp_token: string;
    code: string;
}

export interface TotpRecoverRequest {
    temp_token: string;
    recovery_code: string;
}

// ============================================================
// 客户端档案分配配置 (7 大资源)
// ============================================================

export interface ClientProfileConfig {
    ClassPlan?: string;
    TimeLayout?: string;
    Subjects?: string;
    DefaultSettings?: string;
    Policy?: string;
    Components?: string;
    Credentials?: string;
    [key: string]: string | undefined;
}

// ============================================================
// 配对码
// ============================================================

export interface PairingCodeOut {
    id: string;
    code: string;
    client_uid?: string;
    client_id?: string;
    client_mac?: string;
    client_ip?: string;
    status?: "pending" | "approved" | "rejected";
    approved?: boolean;
    used?: boolean;
    preset_profile?: ClientProfileConfig | null;
    created_at?: string;
    expires_at?: string;
}

export interface PairingStatusResponse {
    pairing_enabled: boolean;
    registration_mode: RegistrationMode;
}

// ============================================================
// 预注册客户端
// ============================================================

export interface PreRegOut {
    id: string;
    account_id: string;
    label: string;
    class_identity: string;
    mac_address?: string | null;
    is_enabled?: boolean;
    preset_profile?: ClientProfileConfig | null;
    bound_client_uid?: string | null;
    created_at: string;
}

export interface PreRegCreate {
    label: string;
    class_identity: string;
    mac_address?: string | null;
    preset_profile?: ClientProfileConfig | null;
}

// ============================================================
// 访问控制
// ============================================================

export interface AccessMember {
    id: string;
    user_id: string;
    account_id: string;
    role_in_account: string;
    joined_at: string;
    username?: string;
    display_name?: string;
    email?: string;
}

export interface AccessRoleUpdate {
    role_in_account: string;
}

/** 账户内角色 */
export const ACCOUNT_ROLE_LABELS: Record<string, string> = {
    owner: "所有者",
    admin: "管理员",
    member: "成员",
    viewer: "观察者",
};

// ============================================================
// 邀请管理
// ============================================================

export interface InvitationOut {
    id: string;
    account_id: string;
    inviter_user_id: string;
    code: string;
    role_in_account: string;
    max_uses: number;
    used_count: number;
    expires_at: string | null;
    is_active: boolean;
    created_at: string;
}

export interface InvitationCreate {
    role_in_account?: string;
    max_uses?: number;
    expires_at?: string | null;
}

// ============================================================
// 系统设置
// ============================================================

/** Admin 设置白名单键 */
export const SETTINGS_ALLOWED_KEYS = [
    "registration_open",
    "require_approval",
    "max_accounts_per_user",
    "default_role",
    "announcement_title",
    "motd",
] as const;

export interface SettingsUpdate {
    items: Record<string, string>;
}

export interface SiteAnnouncement {
    title: string;
    subtitle: string;
}

// ============================================================
// 通知
// ============================================================

export interface NotificationPayload {
    MessageMask?: string;
    MessageContent?: string;
    OverlayIconLeft?: number;
    OverlayIconRight?: number;
    IsEmergency?: boolean;
    IsSpeechEnabled?: boolean;
    IsEffectEnabled?: boolean;
    IsSoundEnabled?: boolean;
    IsTopmost?: boolean;
    DurationSeconds?: number;
    RepeatCounts?: number;
}

// ============================================================
// 批量操作
// ============================================================

export type BatchOpType = "create" | "write" | "update" | "delete";

export interface BatchOperation {
    action: BatchOpType;
    resource_type: string;
    name: string;
    payload?: Record<string, unknown> | null;
}

export interface BatchRequest {
    operations: BatchOperation[];
    target_account_id?: string;
}

export interface ClientBatchRequest {
    client_uids: string[];
    action: "force_sync" | "restart" | "disconnect" | "enable" | "disable" | "delete" | "assign_profile";
    profile_config?: ClientProfileConfig | null;
}

// ============================================================
// 资源类型
// ============================================================

export type ResourceType =
    | "ClassPlan"
    | "TimeLayout"
    | "Subjects"
    | "Policy"
    | "DefaultSettings"
    | "Components"
    | "Credentials";

export const RESOURCE_TYPES: ResourceType[] = [
    "Subjects",
    "TimeLayout",
    "ClassPlan",
    "Policy",
    "Credentials",
    "Components",
    "DefaultSettings",
];

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
    ClassPlan: "课表",
    TimeLayout: "时间表",
    Subjects: "科目",
    Policy: "策略",
    DefaultSettings: "默认设置",
    Components: "组件设置",
    Credentials: "凭据",
};

// ============================================================
// 系统角色
// ============================================================

export const SYSTEM_ROLES = {
    BANNED: "banned",
    PENDING: "pending",
    NORMAL: "normal",
    ADMIN: "admin",
    SUPERADMIN: "superadmin",
} as const;

export const ROLE_LABELS: Record<string, string> = {
    banned: "已封禁",
    pending: "待激活",
    normal: "普通用户",
    admin: "管理员",
    superadmin: "超级管理员",
};

// ============================================================
// ClassIsland 上游数据模型
// ============================================================

/** 科目 */
export interface Subject {
    Name: string;
    Initial: string;
    TeacherName: string;
    IsOutDoor: boolean;
    AttachedObjects?: Record<string, unknown>;
    AttachableSettings?: Record<string, unknown>;
}

/** 时间点类型: 0=上课, 1=课间, 2=分割线, 3=行动 */
export type TimeType = 0 | 1 | 2 | 3;

export const TIME_TYPE_LABELS: Record<TimeType, string> = {
    0: "上课",
    1: "课间休息",
    2: "分割线",
    3: "行动",
};

/** 时间表项 (兼容 StartSecond/EndSecond DateTime 与 StartTime/EndTime) */
export interface TimeLayoutItem {
    StartSecond?: string;
    EndSecond?: string;
    StartTime?: string;
    EndTime?: string;
    TimeType: TimeType;
    IsHideDefault?: boolean;
    DefaultClassId?: string;
    BreakName?: string;
    ActionSet?: Record<string, unknown> | null;
    AttachedObjects?: Record<string, unknown>;
    AttachableSettings?: Record<string, unknown>;
}

/** 时间表 */
export interface TimeLayout {
    Name: string;
    Layouts: TimeLayoutItem[];
    AttachedObjects?: Record<string, unknown>;
    AttachableSettings?: Record<string, unknown>;
}

/** 课程信息 */
export interface ClassInfo {
    SubjectId: string;
    IsChangedClass?: boolean;
    IsEnabled?: boolean;
    AttachedObjects?: Record<string, unknown>;
    AttachableSettings?: Record<string, unknown>;
}

/** 课表触发规则 */
export interface TimeRule {
    WeekDay: number;
    WeekCountDiv: number;
    WeekCountDivTotal: number;
}

/** 课表 */
export interface ClassPlan {
    Name: string;
    TimeLayoutId: string;
    Classes: ClassInfo[];
    TimeRule: TimeRule;
    IsEnabled: boolean;
    IsOverlay?: boolean;
    OverlaySourceId?: string | null;
    OverlaySetupTime?: string;
    AssociatedGroup?: string;
    AttachedObjects?: Record<string, unknown>;
    AttachableSettings?: Record<string, unknown>;
}

/** 课表群 */
export interface ClassPlanGroup {
    Name: string;
    IsGlobal?: boolean;
}

/** 档案 */
export interface Profile {
    Name: string;
    TimeLayouts: Record<string, TimeLayout>;
    ClassPlans: Record<string, ClassPlan>;
    Subjects: Record<string, Subject>;
    ClassPlanGroups?: Record<string, ClassPlanGroup>;
    IsOverlayClassPlanEnabled?: boolean;
    OverlayClassPlanId?: string | null;
    SelectedClassPlanGroupId?: string;
    TempOverlayClassPlanSetupTime?: string;
}

/** 管理策略 */
export interface ManagementPolicy {
    DisableProfileClassPlanEditing?: boolean;
    DisableProfileTimeLayoutEditing?: boolean;
    DisableProfileSubjectsEditing?: boolean;
    DisableProfileEditing?: boolean;
    DisableSettingsEditing?: boolean;
    DisableSplashCustomize?: boolean;
    DisableDebugMenu?: boolean;
    AllowExitManagement?: boolean;
    DisableEasterEggs?: boolean;
}

/** 管理服务器类型: 0=无服务器, 1=集控服务器 */
export type ManagementServerKind = 0 | 1;

export const MANAGEMENT_SERVER_KIND_LABELS: Record<ManagementServerKind, string> = {
    0: "无服务器 (Serverless)",
    1: "集控服务器 (ManagementServer)",
};

/** 引导设置 (ManagementSettings / ManagementPreset.json) */
export interface ManagementSettings {
    IsManagementEnabled?: boolean;
    ManagementServerKind?: ManagementServerKind;
    ManagementServer?: string;
    ManagementServerGrpc?: string;
    ManifestUrlTemplate?: string;
    ClassIdentity?: string;
}

/** 客户端应用默认设置 (ClassIsland.Models.Settings 全量字段) */
export interface AppDefaultSettings {
    /* 1. 常规、档案与课程显示 (General & Schedule) */
    IsMainWindowVisible?: boolean;
    IsWelcomeWindowShowed?: boolean;
    SelectedProfile?: string;
    CurrentComponentConfig?: string;
    ShowDate?: boolean;
    HideOnClass?: boolean;
    SingleWeekStartTime?: string;
    MultiWeekRotationMaxCycle?: number;
    MultiWeekRotationOffset?: Record<string, number>;
    DefaultOnClassTimePointMinutes?: number;
    DefaultBreakingTimePointMinutes?: number;
    ShowExtraInfoOnTimePoint?: boolean;
    ExtraInfoType?: number;
    IsCountdownEnabled?: boolean;
    CountdownSeconds?: number;
    ExtraInfo4ShowSecondsSeconds?: number;
    IsNonExactCountdownEnabled?: boolean;
    ScheduleSpacing?: number;
    ShowCurrentLessonOnlyOnClass?: boolean;
    IsSwapMode?: boolean;
    IsProfileEditorClassInfoSubjectAutoMoveNextEnabled?: boolean;
    ExpAllowEditingActivatedTimeLayout?: boolean;
    ClassPlanEditModeIndex?: number;
    TimeLayoutEditorIndex?: number;

    /* 2. 窗口、停靠、交互与避让规则 (Window, Docking & Hide Rules) */
    WindowDockingLocation?: number;
    WindowDockingMonitorIndex?: number;
    WindowDockingOffsetX?: number;
    WindowDockingOffsetY?: number;
    WindowLayer?: number;
    WindowTopmostRecheckMode?: number;
    IsIgnoreWorkAreaEnabled?: boolean;
    HideMode?: number;
    HideOnFullscreen?: boolean;
    ExcludedFullscreenWindow?: string[];
    HideOnMaxWindow?: boolean;
    IsMouseClickingEnabled?: boolean;
    UseRawInput?: boolean;
    IsMouseInFadingEnabled?: boolean;
    IsMouseInFadingReversed?: boolean;
    TouchInFadingDurationMs?: number;
    TaskBarIconClickBehavior?: number;
    IsCompatibleWindowTransparentEnabled?: boolean;
    IsWaitForTransientDisabled?: boolean;
    AnimationLevel?: number;
    ReduceProgressAccuracy?: boolean;
    IsScreenRecordingModeEnabled?: boolean;
    IsWindowCaptureBlockingEnabled?: boolean;

    /* 3. 外观、主题、色彩与字体 (Appearance, Theme & Fonts) */
    Theme?: number;
    Scale?: number;
    Opacity?: number;
    RadiusX?: number;
    RadiusY?: number;
    MainWindowLineVerticalMargin?: number;
    IsIslandSeperated?: boolean;
    ColorSource?: number;
    PrimaryColor?: string;
    SecondaryColor?: string;
    SelectedPlatteIndex?: number;
    TargetLightValue?: number;
    IsWallpaperAutoUpdateEnabled?: boolean;
    WallpaperAutoUpdateIntervalSeconds?: number;
    WallpaperClassName?: string;
    IsFallbackModeEnabled?: boolean;
    UseExperimentColorPickingMethod?: boolean;
    IsCustomBackgroundColorEnabled?: boolean;
    BackgroundColor?: string;
    IsCustomForegroundColorEnabled?: boolean;
    CustomForegroundColor?: string;
    MainWindowFont?: string;
    MainWindowFontWeight2?: number;
    MainWindowSecondaryFontSize?: number;
    MainWindowBodyFontSize?: number;
    MainWindowEmphasizedFontSize?: number;
    MainWindowLargeFontSize?: number;

    /* 4. 提醒、特效与渠道控制 (Notifications & Effects) */
    IsNotificationEnabled?: boolean;
    IsNotificationEffectEnabled?: boolean;
    IsNotificationSoundEnabled?: boolean;
    NotificationSoundVolume?: number;
    NotificationSoundPath?: string;
    IsNotificationTopmostEnabled?: boolean;
    NotificationEffectRenderingScale?: number;
    IsNotificationEffectRenderingScaleAutoSet?: boolean;
    NotificationUseStandaloneEffectUiThread?: boolean;
    AllowNotificationSpeech?: boolean;
    AllowNotificationEffect?: boolean;
    AllowNotificationSound?: boolean;
    AllowNotificationTopmost?: boolean;
    NotificationProvidersEnableStates?: Record<string, boolean>;
    NotificationProvidersPriority?: string[];

    /* 5. 语音合成 (Speech / TTS) */
    IsSpeechEnabled?: boolean;
    SpeechVolume?: number;
    SpeechSource?: number;
    SelectedSpeechProvider?: string;
    EdgeTtsVoiceName?: string;
    NotificationSpeechCustomSmgTokenSource?: string;
    GptSoVitsSpeechSettings?: Record<string, unknown>;

    /* 6. 天气与气象预警 (Weather) */
    CityId?: string;
    CityName?: string;
    WeatherLocationSource?: number;
    WeatherLongitude?: number;
    WeatherLatitude?: number;
    AutoRefreshWeatherLocation?: boolean;
    NoTLSWeatherRequests?: boolean;
    ExcludedWeatherAlerts?: string[];
    WeatherIconId?: string;

    /* 7. 时间同步与校准 (Time & NTP) */
    IsExactTimeEnabled?: boolean;
    ExactTimeServer?: string;
    TimeOffsetSeconds?: number;
    IsTimeAutoAdjustEnabled?: boolean;
    TimeAutoAdjustSeconds?: number;

    /* 8. 启动画面、自动化、备份、更新与诊断 (System, Backup, Updates & Debug) */
    IsSplashEnabled?: boolean;
    SplashCustomText?: string;
    SplashCustomLogoSource?: string;
    ShowDetailedStatusOnSplash?: boolean;
    IsAutomationEnabled?: boolean;
    CurrentAutomationConfig?: string;
    IsAutomationWarningVisible?: boolean;
    IsAutoBackupEnabled?: boolean;
    AutoBackupIntervalDays?: number;
    AutoBackupLimit?: number;
    UpdateMode?: number;
    SelectedUpdateChannelV2?: string;
    SelectedUpdateMirrorV2?: string;
    AutoInstallUpdateNextStartup?: boolean;
    OfficialSelectedMirror?: string;
    IgnoreSslForPluginMirrors?: boolean;
    IsPluginsAutoUpdateEnabled?: boolean;
    IsPluginsUpdateNotificationEnabled?: boolean;
    AutoDisableCorruptPlugins?: boolean;
    IsCriticalSafeMode?: boolean;
    CriticalSafeModeMethod?: number;
    IsReportingEnabled?: boolean;
    IsRefreshingToastEnabled?: boolean;
    RefreshingToastThresholdDays?: number;
    MaxRefreshingToastCounts?: number;
    ShowEchoCaveWhenSettingsPageLoading?: boolean;
    SettingsPagesCachePolicy?: number;
    IsDebugEnabled?: boolean;
    IsDebugOptionsEnabled?: boolean;
    IsMainWindowDebugEnabled?: boolean;
    IsDebugConsoleEnabled?: boolean;
    DebugAnimationScale?: number;
    [key: string]: unknown;
}

/** 授权等级: 0=无, 1=用户认证, 2=管理员认证 */
export type AuthorizeLevel = 0 | 1 | 2;

export const AUTHORIZE_LEVEL_LABELS: Record<AuthorizeLevel, string> = {
    0: "无需认证 (None)",
    1: "用户认证 (User)",
    2: "管理员认证 (Admin)",
};

/** 凭据配置 (ManagementCredentialConfig) */
export interface ManagementCredentialConfig {
    UserCredential?: string;
    AdminCredential?: string;
    EditAuthorizeSettingsAuthorizeLevel?: AuthorizeLevel;
    EditPolicyAuthorizeLevel?: AuthorizeLevel;
    ExitManagementAuthorizeLevel?: AuthorizeLevel;
    EditProfileAuthorizeLevel?: AuthorizeLevel;
    EditSettingsAuthorizeLevel?: AuthorizeLevel;
    ExitApplicationAuthorizeLevel?: AuthorizeLevel;
    EditComponentsAuthorizeLevel?: AuthorizeLevel;
    PluginManagementAuthorizeLevel?: AuthorizeLevel;
    ChangeLessonsAuthorizeLevel?: AuthorizeLevel;
}

/** 水平对齐方式: 0=Stretch, 1=Left, 2=Center, 3=Right */
export type HorizontalAlignmentType = 0 | 1 | 2 | 3;

export const HORIZONTAL_ALIGNMENT_LABELS: Record<HorizontalAlignmentType, string> = {
    0: "拉伸 (Stretch)",
    1: "左对齐 (Left)",
    2: "居中 (Center)",
    3: "右对齐 (Right)",
};

/** 组件设置项 (ComponentSettings) */
export interface ComponentSettingsItem {
    Id?: string;
    NameCache?: string;
    Settings?: unknown;
    HideOnRule?: boolean;
    HidingRules?: unknown;
    /* 字体大小 */
    IsResourceOverridingEnabled?: boolean;
    MainWindowSecondaryFontSize?: number;
    MainWindowBodyFontSize?: number;
    MainWindowEmphasizedFontSize?: number;
    MainWindowLargeFontSize?: number;
    /* 颜色 */
    IsCustomForegroundColorEnabled?: boolean;
    ForegroundColor?: string;
    IsCustomBackgroundColorEnabled?: boolean;
    BackgroundColor?: string;
    IsCustomBackgroundOpacityEnabled?: boolean;
    BackgroundOpacity?: number;
    IsCustomCornerRadiusEnabled?: boolean;
    CustomCornerRadius?: number;
    Opacity?: number;
    /* 布局 */
    RelativeLineNumber?: number;
    HorizontalAlignment?: HorizontalAlignmentType;
    IsMinWidthEnabled?: boolean;
    MinWidth?: number;
    IsMaxWidthEnabled?: boolean;
    MaxWidth?: number;
    IsFixedWidthEnabled?: boolean;
    FixedWidth?: number;
    IsCustomMarginEnabled?: boolean;
    MarginLeft?: number;
    MarginTop?: number;
    MarginRight?: number;
    MarginBottom?: number;
    LastWidthCache?: number;
}

/** 主界面行设置 (MainWindowLineSettings) */
export interface ComponentLineSettings {
    Children: ComponentSettingsItem[];
    IslandSeparationMode?: number;
    IsMainLine?: boolean;
    IsEnabled?: boolean;
    HideOnRule?: boolean;
    IsResourceOverridingEnabled?: boolean;
    MainWindowSecondaryFontSize?: number;
    MainWindowBodyFontSize?: number;
    MainWindowEmphasizedFontSize?: number;
    MainWindowLargeFontSize?: number;
    IsCustomForegroundColorEnabled?: boolean;
    ForegroundColor?: string;
    IsCustomBackgroundColorEnabled?: boolean;
    BackgroundColor?: string;
    IsCustomBackgroundOpacityEnabled?: boolean;
    BackgroundOpacity?: number;
    IsCustomCornerRadiusEnabled?: boolean;
    CustomCornerRadius?: number;
    Opacity?: number;
}

/** 组件配置档案 (ComponentProfile) */
export interface ComponentProfile {
    Lines: ComponentLineSettings[];
}

/** 上游内置组件列表 */
export const BUILTIN_COMPONENTS: Array<{ id: string; name: string; desc: string }> = [
    { id: "df398495-e1f4-4e4e-b62c-512000e55029", name: "课程表", desc: "显示今日课程表与当前进度" },
    { id: "9781b66c-647c-463b-bd42-8879901c2d08", name: "时钟", desc: "显示当前数字时间" },
    { id: "c01377d5-9072-4c72-975a-c71b161b61d0", name: "日期", desc: "显示今日日期与星期" },
    { id: "a5a2e554-1c59-4b11-9472-b15e8767d814", name: "天气", desc: "显示实时天气与气象预警" },
    { id: "856510b1-9464-4822-b472-5e997e61001b", name: "倒计时", desc: "显示指定事件距离天数" },
    { id: "f63f108c-227c-414b-9e65-2e6f18471f7b", name: "滚动文本", desc: "横向滚动展示通知标语" },
    { id: "341b6d16-8f5b-46b2-9551-208b6511e2a0", name: "分隔线", desc: "在组件之间插入视觉分隔符" },
    { id: "48c55091-1f5a-4d6e-91c8-a0b528c45646", name: "分组容器", desc: "容纳多个子组件的布局容器" },
    { id: "78998996-96f9-47f4-a1e8-4f8c0965e7e6", name: "轮播容器", desc: "定时轮播展示内部子组件" },
];

// ============================================================
// 客户端设备与远程上报/审计
// ============================================================

export interface ClientDeviceOut {
    uid: string;
    client_id: string;
    display_name: string;
    mac: string;
    ip: string | null;
    is_disabled: boolean;
    status: "online" | "offline";
    registered_at: string | null;
    last_seen_at: string | null;
    profile_config: ClientProfileConfig;
    has_custom_profile: boolean;
}

export interface ClientInfo extends Partial<ClientDeviceOut> {
    uid: string;
    [key: string]: unknown;
}

export const CONFIG_TYPE_LABELS: Record<number, string> = {
    1: "应用设置 (AppSettings)",
    2: "当前档案 (Profile)",
    3: "组件配置 (Components)",
    4: "自动化配置 (Automations)",
    5: "运行日志 (Logs)",
    6: "已安装插件 (Plugins)",
};

export interface ConfigUploadItem {
    request_guid: string;
    client_uid: string | null;
    config_type: number;
    config_type_name: string;
    status: "pending" | "completed";
    uploaded_at: string | null;
    payload_preview?: string;
    payload?: string;
    parsed_payload?: unknown;
}

export const AUDIT_EVENT_LABELS: Record<number, string> = {
    0: "未指定事件",
    1: "授权成功 (AuthorizeSuccess)",
    2: "授权失败 (AuthorizeFailed)",
    3: "应用启动 (AppStarted)",
    4: "正常退出 (AppExited)",
    5: "应用崩溃 (AppCrashed)",
    6: "设置变更 (AppSettingsChanged)",
    7: "插件安装 (PluginInstalled)",
    8: "插件卸载 (PluginUninstalled)",
    9: "集控加入 (ManagementJoined)",
    10: "集控退出 (ManagementExited)",
    11: "配置同步完成 (ConfigUpdated)",
    12: "课表换课 (ClassPlanChanged)",
    13: "规则状态变更 (RulesetChanged)",
};

export interface AuditLogItem {
    id: number;
    client_uid: string;
    event_type: number;
    event_name: string;
    timestamp_utc: number;
    logged_at: string | null;
    decoded: Record<string, unknown>;
}

// ============================================================
// 2FA 登录流中间态
// ============================================================

export interface TwoFARequired {
    requires_2fa: true;
    temp_token: string;
}

export type LoginResult = TokenResponse | TwoFARequired;

// ============================================================
// 周几名称
// ============================================================

export const WEEKDAY_LABELS = [
    "周日", "周一", "周二", "周三", "周四", "周五", "周六"
];

export interface ResourceHistoryItem {
    version: number;
    name: string;
    resource_type: string;
    updated_at: string;
    size_bytes: number;
    is_current: boolean;
}

export interface ResourceHistoryVersionOut {
    version: number;
    name: string;
    resource_type: string;
    updated_at: string;
    content: unknown;
}

// ============================================================
// 工单系统
// ============================================================

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type TicketCategory = "account" | "client" | "bug" | "feature" | "other";

export interface TicketMessage {
    id: number;
    author_id: string;
    author_role: "user" | "admin";
    content: string;
    created_at: string;
}

export interface TicketUserSummary {
    id: string;
    username: string;
    email: string;
    display_name: string;
    role_code: string;
    is_active: boolean;
}

export interface TicketItem {
    id: string;
    user_id: string;
    subject: string;
    category: TicketCategory;
    priority: TicketPriority;
    status: TicketStatus;
    created_at: string;
    updated_at: string;
    last_reply_at: string | null;
    last_reply_by: string;
    admin_unread: boolean;
    user_unread: boolean;
    message_count: number;
    user?: TicketUserSummary | null;
}

export interface TicketDetail extends TicketItem {
    content: string;
    messages: TicketMessage[];
}

export interface TicketListResponse {
    total: number;
    items: TicketItem[];
}

export interface TicketCreateRequest {
    subject: string;
    content: string;
    category: TicketCategory;
    priority: TicketPriority;
}

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
    open: "待处理",
    in_progress: "处理中",
    resolved: "已解决",
    closed: "已关闭",
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
    low: "低",
    normal: "普通",
    high: "高",
    urgent: "紧急",
};

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
    account: "账户问题",
    client: "客户端问题",
    bug: "故障报告",
    feature: "功能建议",
    other: "其他",
};
