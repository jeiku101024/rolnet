module.exports = [
(()=>{"use strict";return[
"[project]/.next-internal/server/app/(owner)/units/page/actions.js { ACTIONS_MODULE0 => \"[project]/app/actions/units.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "40c5b9900197588955b3497e4404e92c55ce374fb9",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$actions$2f$units$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createUnit"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f28$owner$292f$units$2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$app$2f$actions$2f$units$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/.next-internal/server/app/(owner)/units/page/actions.js { ACTIONS_MODULE0 => "[project]/app/actions/units.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$actions$2f$units$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/actions/units.ts [app-rsc] (ecmascript)");
}),
"[project]/.next-internal/server/app/(owner)/units/page/actions.js { ACTIONS_MODULE0 => \"[project]/app/actions/units.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$actions$2f$units$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/actions/units.ts [app-rsc] (ecmascript)");
;
}),
"[project]/app/actions/units.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"40c5b9900197588955b3497e4404e92c55ce374fb9":{"name":"createUnit"},"40e55fe3410320b41aa4dc13294d0ac99bdc2f5d96":{"name":"softDeleteUnit"},"604e36f08f1f4fa58ccffe7b5ccfdcdf87cd88cc7b":{"name":"updateUnit"}},"app/actions/units.ts",""] */ __turbopack_context__.s([
    "createUnit",
    ()=>createUnit,
    "softDeleteUnit",
    ()=>softDeleteUnit,
    "updateUnit",
    ()=>updateUnit
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.4.0_@babel+core@7.2_6944613f737f7842812f8953ca9c8f62/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.4.0_@babel+core@7.2_6944613f737f7842812f8953ca9c8f62/node_modules/next/cache.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase/server.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2f$guards$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/auth/guards.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$validation$2f$units$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/validation/units.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.4.0_@babel+core@7.2_6944613f737f7842812f8953ca9c8f62/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
;
;
async function createUnit(input) {
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2f$guards$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requirePermission"])("manage_master_data");
    const value = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$validation$2f$units$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unitSchema"].parse(input);
    const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createSupabaseServerClient"])();
    const { data, error } = await supabase.from("units").insert({
        body_number: value.bodyNumber,
        plate_number: value.plateNumber,
        make_model: value.makeModel,
        status: value.status
    }).select().single();
    if (error) throw new Error("Could not create unit");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])("/units");
    return data;
}
async function updateUnit(id, input) {
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2f$guards$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requirePermission"])("manage_master_data");
    const value = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$validation$2f$units$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unitSchema"].parse(input);
    const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createSupabaseServerClient"])();
    const { data, error } = await supabase.from("units").update({
        body_number: value.bodyNumber,
        plate_number: value.plateNumber,
        make_model: value.makeModel,
        status: value.status
    }).eq("id", id).select().single();
    if (error) throw new Error("Could not update unit");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])("/units");
    return data;
}
async function softDeleteUnit(id) {
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2f$guards$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requirePermission"])("manage_master_data");
    const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createSupabaseServerClient"])();
    const { error } = await supabase.from("units").update({
        deleted_at: new Date().toISOString()
    }).eq("id", id);
    if (error) throw new Error("Could not archive unit");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["revalidatePath"])("/units");
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    createUnit,
    updateUnit,
    softDeleteUnit
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createUnit, "40c5b9900197588955b3497e4404e92c55ce374fb9", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(updateUnit, "604e36f08f1f4fa58ccffe7b5ccfdcdf87cd88cc7b", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(softDeleteUnit, "40e55fe3410320b41aa4dc13294d0ac99bdc2f5d96", null);
}),
"[project]/lib/auth/guards.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getSessionProfile",
    ()=>getSessionProfile,
    "requireApprovedSession",
    ()=>requireApprovedSession,
    "requirePermission",
    ()=>requirePermission
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$track$2d$dynamic$2d$import$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.4.0_@babel+core@7.2_6944613f737f7842812f8953ca9c8f62/node_modules/next/dist/build/webpack/loaders/next-flight-loader/track-dynamic-import.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.4.0_@babel+core@7.2_6944613f737f7842812f8953ca9c8f62/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.4.0_@babel+core@7.2_6944613f737f7842812f8953ca9c8f62/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase/server.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$permissions$2f$roles$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/permissions/roles.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$demo$2f$mode$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/demo/mode.ts [app-rsc] (ecmascript)");
;
;
;
;
;
async function getSessionProfile() {
    if (__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$demo$2f$mode$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["demoMode"]) return {
        userId: "demo-owner",
        displayName: "Demo Owner",
        role: "owner",
        accountStatus: "approved"
    };
    const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createSupabaseServerClient"])();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase.from("profiles").select("user_id, display_name, role, account_status").eq("user_id", user.id).maybeSingle();
    if (!profile) return null;
    return {
        userId: profile.user_id,
        displayName: profile.display_name,
        role: profile.role,
        accountStatus: profile.account_status
    };
}
async function requireApprovedSession() {
    const profile = await getSessionProfile();
    if (!profile) (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])("/login");
    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$permissions$2f$roles$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isApproved"])(profile.accountStatus)) (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])(`/login?error=${profile.accountStatus}`);
    return profile;
}
async function requirePermission(permission) {
    const profile = await requireApprovedSession();
    const { hasPermission } = await /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$track$2d$dynamic$2d$import$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["trackDynamicImport"])(__turbopack_context__.A("[project]/lib/permissions/roles.ts [app-rsc] (ecmascript, async loader)"));
    if (!hasPermission(profile.role, permission)) (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])("/forbidden");
    return profile;
}
}),
"[project]/lib/demo/mode.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "demoAssignments",
    ()=>demoAssignments,
    "demoAuditEvents",
    ()=>demoAuditEvents,
    "demoCategories",
    ()=>demoCategories,
    "demoDocuments",
    ()=>demoDocuments,
    "demoDrivers",
    ()=>demoDrivers,
    "demoExpenses",
    ()=>demoExpenses,
    "demoMasterEmail",
    ()=>demoMasterEmail,
    "demoMasterPassword",
    ()=>demoMasterPassword,
    "demoMode",
    ()=>demoMode,
    "demoRemittances",
    ()=>demoRemittances,
    "demoUnits",
    ()=>demoUnits
]);
const demoMode = ("TURBOPACK compile-time value", "true") === "true";
const demoMasterEmail = process.env.DEMO_MASTER_EMAIL || "owner@demo.local";
const demoMasterPassword = process.env.DEMO_MASTER_PASSWORD || "demo1234";
const demoUnits = [
    {
        id: "00000000-0000-4000-8000-000000000001",
        body_number: "T-001",
        plate_number: "ABC-1234",
        make_model: "Honda TMX",
        status: "active",
        current_mileage: 18240
    },
    {
        id: "00000000-0000-4000-8000-000000000002",
        body_number: "T-002",
        plate_number: "ABC-1235",
        make_model: "Yamaha YTX",
        status: "in_repair",
        current_mileage: 24110
    }
];
const demoDrivers = [
    {
        id: "00000000-0000-4000-8000-000000000011",
        full_name: "Juan Dela Cruz",
        driver_kind: "primary",
        license_number: "N01-23-456789",
        license_expiry_date: "2027-06-30",
        phone: "09171234567",
        is_active: true
    },
    {
        id: "00000000-0000-4000-8000-000000000012",
        full_name: "Pedro Santos",
        driver_kind: "backup",
        license_number: "N01-23-456790",
        license_expiry_date: "2027-03-15",
        phone: "09181234567",
        is_active: true
    }
];
const demoCategories = [
    {
        id: "00000000-0000-4000-8000-000000000021",
        name: "Fuel"
    },
    {
        id: "00000000-0000-4000-8000-000000000022",
        name: "Repairs"
    },
    {
        id: "00000000-0000-4000-8000-000000000023",
        name: "Registration"
    },
    {
        id: "00000000-0000-4000-8000-000000000024",
        name: "Insurance"
    }
];
const demoAssignments = [
    {
        id: "00000000-0000-4000-8000-000000000031",
        starts_on: "2026-01-01",
        ends_on: null,
        units: [
            {
                body_number: "T-001"
            }
        ],
        drivers: [
            {
                full_name: "Juan Dela Cruz"
            }
        ]
    }
];
const demoExpenses = [
    {
        id: "00000000-0000-4000-8000-000000000041",
        expense_date: "2026-10-05",
        amount_centavos: 185000,
        notes: "Monthly tune-up",
        receipt_object_path: null,
        units: [
            {
                body_number: "T-001"
            }
        ],
        expense_categories: [
            {
                name: "Repairs"
            }
        ]
    }
];
const demoRemittances = [
    {
        id: "00000000-0000-4000-8000-000000000051",
        service_date: "2026-10-19",
        disposition: "returned",
        amount_due_centavos: 18000,
        notes: "",
        updated_at: "2026-10-19T08:00:00Z",
        units: [
            {
                body_number: "T-001"
            }
        ],
        drivers: [
            {
                full_name: "Juan Dela Cruz"
            }
        ],
        remittance_payments: [
            {
                amount_centavos: 18000
            }
        ]
    }
];
const demoDocuments = [
    {
        id: "00000000-0000-4000-8000-000000000061",
        document_type: "insurance",
        expires_on: "2026-11-10",
        object_path: "demo",
        lifecycle_status: "current"
    }
];
const demoAuditEvents = [
    {
        id: 1,
        occurred_at: "2026-10-19T08:00:00Z",
        action: "insert",
        entity_type: "units"
    }
];
}),
"[project]/lib/permissions/roles.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "hasPermission",
    ()=>hasPermission,
    "isApproved",
    ()=>isApproved
]);
const permissions = {
    owner: [
        "manage_master_data",
        "encode_operations",
        "manage_documents",
        "view_dashboard",
        "export_reports",
        "manage_users",
        "view_audit"
    ],
    staff: [
        "encode_operations"
    ]
};
function hasPermission(role, permission) {
    return permissions[role].includes(permission);
}
function isApproved(status) {
    return status === "approved";
}
}),
"[project]/lib/supabase/server.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createSupabaseServerClient",
    ()=>createSupabaseServerClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$supabase$2b$ssr$40$0$2e$7$2e$0_$40$supabase$2b$supabase$2d$js$40$2$2e$118$2e$0$2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@supabase+ssr@0.7.0_@supabase+supabase-js@2.118.0/node_modules/@supabase/ssr/dist/module/index.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$supabase$2b$ssr$40$0$2e$7$2e$0_$40$supabase$2b$supabase$2d$js$40$2$2e$118$2e$0$2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@supabase+ssr@0.7.0_@supabase+supabase-js@2.118.0/node_modules/@supabase/ssr/dist/module/createServerClient.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.4.0_@babel+core@7.2_6944613f737f7842812f8953ca9c8f62/node_modules/next/headers.js [app-rsc] (ecmascript)");
;
;
async function createSupabaseServerClient() {
    const cookieStore = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cookies"])();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) throw new Error("Supabase server environment variables are missing");
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$supabase$2b$ssr$40$0$2e$7$2e$0_$40$supabase$2b$supabase$2d$js$40$2$2e$118$2e$0$2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createServerClient"])(url, anonKey, {
        cookies: {
            getAll () {
                return cookieStore.getAll();
            },
            setAll (cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options })=>cookieStore.set(name, value, options));
                } catch  {
                // Server Components cannot always write cookies; middleware refreshes the session.
                }
            }
        }
    });
}
}),
"[project]/lib/validation/units.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "mileageSchema",
    ()=>mileageSchema,
    "unitSchema",
    ()=>unitSchema
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$4$2e$6$2e$7$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$object$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zod@4.6.7/node_modules/zod/v4/classic/external.js [app-rsc] (ecmascript) <export * as z .object>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$4$2e$6$2e$7$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zod@4.6.7/node_modules/zod/v4/classic/external.js [app-rsc] (ecmascript) <export * as z .string>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$4$2e$6$2e$7$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$enum$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zod@4.6.7/node_modules/zod/v4/classic/external.js [app-rsc] (ecmascript) <export * as z .enum>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$4$2e$6$2e$7$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$number$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zod@4.6.7/node_modules/zod/v4/classic/external.js [app-rsc] (ecmascript) <export * as z .number>");
;
const unitSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$4$2e$6$2e$7$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$object$3e$__["z"].object({
    bodyNumber: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$4$2e$6$2e$7$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string().trim().min(1).max(40),
    plateNumber: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$4$2e$6$2e$7$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string().trim().min(1).max(20),
    makeModel: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$4$2e$6$2e$7$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string().trim().min(1).max(120),
    status: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$4$2e$6$2e$7$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$enum$3e$__["z"].enum([
        "active",
        "in_repair",
        "retired"
    ])
});
const mileageSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$4$2e$6$2e$7$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$object$3e$__["z"].object({
    unitId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$4$2e$6$2e$7$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string().uuid(),
    readingDate: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$4$2e$6$2e$7$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mileage: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$4$2e$6$2e$7$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$number$3e$__["z"].number().int().nonnegative(),
    notes: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$4$2e$6$2e$7$2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string().max(500).optional()
});
}),
]})(),
"[externals]/next/dist/server/app-render/module-loading/track-module-loading.external.js [external] (next/dist/server/app-render/module-loading/track-module-loading.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/module-loading/track-module-loading.external.js", () => require("next/dist/server/app-render/module-loading/track-module-loading.external.js"));

module.exports = mod;
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0i5k31ty82rq_._.js.map