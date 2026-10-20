(()=>{"use strict";module.exports = [
"[project]/components/forms/demo-login-form.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DemoLoginForm",
    ()=>DemoLoginForm
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.4.0_@babel+core@7.2_6944613f737f7842812f8953ca9c8f62/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.4.0_@babel+core@7.2_6944613f737f7842812f8953ca9c8f62/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$demo$2f$mode$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/demo/mode.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
function DemoLoginForm() {
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
        className: "space-y-4",
        onSubmit: (e)=>{
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (f.get("email") === __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$demo$2f$mode$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["demoMasterEmail"] && f.get("password") === __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$demo$2f$mode$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["demoMasterPassword"]) {
                window.location.assign("/");
            } else setError("Use the demo credentials shown above.");
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                className: "block text-sm font-medium",
                children: [
                    "Email",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        required: true,
                        name: "email",
                        type: "email",
                        className: "mt-1 min-h-11 w-full rounded-md border p-3"
                    }, void 0, false, {
                        fileName: "[project]/components/forms/demo-login-form.tsx",
                        lineNumber: 4,
                        columnNumber: 391
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/forms/demo-login-form.tsx",
                lineNumber: 4,
                columnNumber: 341
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                className: "block text-sm font-medium",
                children: [
                    "Password",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        required: true,
                        name: "password",
                        type: "password",
                        className: "mt-1 min-h-11 w-full rounded-md border p-3"
                    }, void 0, false, {
                        fileName: "[project]/components/forms/demo-login-form.tsx",
                        lineNumber: 4,
                        columnNumber: 551
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/forms/demo-login-form.tsx",
                lineNumber: 4,
                columnNumber: 498
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                className: "min-h-11 w-full rounded-md bg-slate-900 px-4 py-2 font-medium text-white",
                type: "submit",
                children: "Sign in"
            }, void 0, false, {
                fileName: "[project]/components/forms/demo-login-form.tsx",
                lineNumber: 4,
                columnNumber: 664
            }, this),
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$0_$40$babel$2b$core$40$7$2e$2_6944613f737f7842812f8953ca9c8f62$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "alert",
                className: "text-sm text-red-700",
                children: error
            }, void 0, false, {
                fileName: "[project]/components/forms/demo-login-form.tsx",
                lineNumber: 4,
                columnNumber: 795
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/forms/demo-login-form.tsx",
        lineNumber: 4,
        columnNumber: 76
    }, this);
}
}),
"[project]/lib/demo/mode.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
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
"[project]/node_modules/.pnpm/next@16.4.0_@babel+core@7.2_6944613f737f7842812f8953ca9c8f62/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

module.exports = __turbopack_context__.r("[project]/node_modules/.pnpm/next@16.4.0_@babel+core@7.2_6944613f737f7842812f8953ca9c8f62/node_modules/next/dist/server/route-modules/app-page/module.compiled.js [app-ssr] (ecmascript)").vendored['react-ssr'].ReactJsxDevRuntime;
}),
];})()

//# sourceMappingURL=_1290wjeyjveop._.js.map