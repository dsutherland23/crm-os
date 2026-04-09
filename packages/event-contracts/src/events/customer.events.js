"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerUpdatedEventSchema = void 0;
const zod_1 = require("zod");
exports.CustomerUpdatedEventSchema = zod_1.z.object({
    eventId: zod_1.z.string().uuid(),
    eventType: zod_1.z.literal('CUSTOMER_UPDATED'),
    occurredAt: zod_1.z.string().datetime(),
    tenantId: zod_1.z.string().uuid(),
    payload: zod_1.z.object({
        customerId: zod_1.z.string().uuid(),
        changedFields: zod_1.z.array(zod_1.z.string()),
        updatedById: zod_1.z.string().uuid(),
    }),
});
//# sourceMappingURL=customer.events.js.map