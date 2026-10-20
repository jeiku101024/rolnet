module.exports = [
(()=>{"use strict";return[
"[project]/app/(owner)/units/[id]/page.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>UnitDetailPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.4.0_@babel+core@7.2_6944613f737f7842812f8953ca9c8f62/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.4.0_@babel+core@7.2_6944613f737f7842812f8953ca9c8f62/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.4.0_@babel+core@7.2_6944613f737f7842812f8953ca9c8f62/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2f$guards$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/auth/guards.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase/server.ts [app-rsc] (ecmascript)");
;
;
;
;
async function UnitDetailPage({ params }) {
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2f$guards$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requireApprovedSession"])();
    const { id } = await params;
    const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createSupabaseServerClient"])();
    const { data: unit } = await supabase.from("units").select("id, body_number, plate_number, make_model, status, current_mileage").eq("id", id).is("deleted_at", null).maybeSingle();
    if (!unit) (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["notFound"])();
    const { data: assignments } = await supabase.from("driver_assignments").select("id, assignment_type, starts_on, ends_on, drivers(full_name)").eq("unit_id", id).is("deleted_at", null).order("starts_on", {
        ascending: false
    });
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "mx-auto w-full max-w-3xl space-y-6 px-4 py-6",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm font-medium text-blue-700",
                        children: "Unit history"
                    }, void 0, false, {
                        fileName: "[project]/app/(owner)/units/[id]/page.tsx",
                        lineNumber: 12,
                        columnNumber: 81
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                        className: "mt-1 text-2xl font-semibold",
                        children: [
                            "Body ",
                            unit.body_number
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/(owner)/units/[id]/page.tsx",
                        lineNumber: 12,
                        columnNumber: 146
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-2 text-slate-600",
                        children: [
                            unit.plate_number,
                            " · ",
                            unit.make_model,
                            " · ",
                            unit.status.replace("_", " ")
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/(owner)/units/[id]/page.tsx",
                        lineNumber: 12,
                        columnNumber: 218
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/(owner)/units/[id]/page.tsx",
                lineNumber: 12,
                columnNumber: 76
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-lg border bg-white p-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm text-slate-600",
                        children: "Current mileage"
                    }, void 0, false, {
                        fileName: "[project]/app/(owner)/units/[id]/page.tsx",
                        lineNumber: 12,
                        columnNumber: 384
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-1 text-2xl font-semibold",
                        children: [
                            unit.current_mileage.toLocaleString(),
                            " km"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/(owner)/units/[id]/page.tsx",
                        lineNumber: 12,
                        columnNumber: 441
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/(owner)/units/[id]/page.tsx",
                lineNumber: 12,
                columnNumber: 336
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-lg font-semibold",
                        children: "Assignment history"
                    }, void 0, false, {
                        fileName: "[project]/app/(owner)/units/[id]/page.tsx",
                        lineNumber: 12,
                        columnNumber: 541
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                        className: "mt-3 space-y-2",
                        children: (assignments ?? []).map((assignment)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                className: "rounded-lg border bg-white p-3 text-sm",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "font-medium",
                                        children: assignment.drivers?.[0]?.full_name ?? "Unknown driver"
                                    }, void 0, false, {
                                        fileName: "[project]/app/(owner)/units/[id]/page.tsx",
                                        lineNumber: 12,
                                        columnNumber: 749
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "ml-2 capitalize text-slate-600",
                                        children: assignment.assignment_type
                                    }, void 0, false, {
                                        fileName: "[project]/app/(owner)/units/[id]/page.tsx",
                                        lineNumber: 12,
                                        columnNumber: 878
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-slate-500",
                                        children: [
                                            assignment.starts_on,
                                            " to ",
                                            assignment.ends_on ?? "current"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/(owner)/units/[id]/page.tsx",
                                        lineNumber: 12,
                                        columnNumber: 962
                                    }, this)
                                ]
                            }, assignment.id, true, {
                                fileName: "[project]/app/(owner)/units/[id]/page.tsx",
                                lineNumber: 12,
                                columnNumber: 674
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/app/(owner)/units/[id]/page.tsx",
                        lineNumber: 12,
                        columnNumber: 602
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/(owner)/units/[id]/page.tsx",
                lineNumber: 12,
                columnNumber: 536
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/(owner)/units/[id]/page.tsx",
        lineNumber: 12,
        columnNumber: 10
    }, this);
}
}),
"[project]/app/favicon.ico.mjs { IMAGE => \"[project]/app/favicon.ico (static in ecmascript, tag client)\" } [app-rsc] (structured image object, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$favicon$2e$ico__$28$static__in__ecmascript$2c$__tag__client$29$__ = __turbopack_context__.i("[project]/app/favicon.ico (static in ecmascript, tag client)");
;
const __TURBOPACK__default__export__ = {
    src: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$favicon$2e$ico__$28$static__in__ecmascript$2c$__tag__client$29$__["default"],
    width: 48,
    height: 48
};
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
]})(),
"[externals]/next/dist/server/app-render/module-loading/track-module-loading.external.js [external] (next/dist/server/app-render/module-loading/track-module-loading.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/module-loading/track-module-loading.external.js", () => require("next/dist/server/app-render/module-loading/track-module-loading.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[project]/app/(owner)/units/[id]/page.tsx [app-rsc] (ecmascript, Next.js Server Component)", (function(__turbopack_context__){

__turbopack_context__.n(__turbopack_context__.i("[project]/app/(owner)/units/[id]/page.tsx [app-rsc] (ecmascript)"));
}),
"[project]/app/favicon.ico (static in ecmascript, tag client)", ((__turbopack_context__) => {

__turbopack_context__.v("/_next/static/media/favicon.117ezoe8m31dk.ico" + (globalThis["NEXT_CLIENT_ASSET_SUFFIX"] || ''));}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__128p_gy7s9f9f._.js.map