-- FX-011: Market Creation Engine & Weekly Slate Builder

-- Add DRAFT and SCHEDULED to MarketStatus enum
ALTER TYPE "MarketStatus" ADD VALUE 'DRAFT';
ALTER TYPE "MarketStatus" ADD VALUE 'SCHEDULED';

-- Add new admin audit actions
ALTER TYPE "AdminAuditAction" ADD VALUE 'MARKET_CREATE';
ALTER TYPE "AdminAuditAction" ADD VALUE 'BULK_OPEN';
ALTER TYPE "AdminAuditAction" ADD VALUE 'BULK_LOCK';
ALTER TYPE "AdminAuditAction" ADD VALUE 'BULK_VOID';
ALTER TYPE "AdminAuditAction" ADD VALUE 'WEEK_CREATE';
ALTER TYPE "AdminAuditAction" ADD VALUE 'WEEK_ACTIVATE';
ALTER TYPE "AdminAuditAction" ADD VALUE 'WEEK_DEACTIVATE';
ALTER TYPE "AdminAuditAction" ADD VALUE 'WEEK_ARCHIVE';
