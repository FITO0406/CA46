# Deferred store module

The order form, order management and pickup screen are excluded from the CA46 launch by the owner (2026-10-17). Their client components are retained here for future work. The former routes redirect temporarily to the home page before layouts mount. Their page implementations also call notFound as a second guard.

Before reactivation: implement and verify company-scoped products, orders and configuration tables, RLS and API permissions; remove fixed business references; complete consumer/privacy requirements and test two independent companies. Do not reconnect these pages merely because they compile.

The traceability label display at /etiquetas remains a separate feature.
