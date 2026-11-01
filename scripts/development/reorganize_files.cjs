const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');

const targetDirs = [
  'docs/architecture',
  'docs/database',
  'docs/security',
  'docs/testing',
  'docs/audits',
  'docs/bug-reports',
  'docs/deployment',
  'docs/release-notes',
  'docs/development',
  'docs/archive',
  'scripts/database',
  'scripts/testing',
  'scripts/maintenance',
  'scripts/development'
];

targetDirs.forEach(d => {
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, { recursive: true });
    console.log('Created directory:', d);
  }
});

const moves = {
  // Existing docs/ files
  'docs/ARCHITECTURE.md': 'docs/architecture/ARCHITECTURE.md',
  'docs/PROJECT_OVERVIEW.md': 'docs/architecture/PROJECT_OVERVIEW.md',
  'docs/DESIGN.md': 'docs/architecture/DESIGN.md',
  'docs/AI_WORKFLOW.md': 'docs/architecture/AI_WORKFLOW.md',
  'docs/ROADMAP.md': 'docs/architecture/ROADMAP.md',
  'docs/DATABASE_AND_ACCOUNTING.md': 'docs/database/DATABASE_AND_ACCOUNTING.md',
  'docs/production-backup.md': 'docs/database/production-backup.md',
  'docs/SECURITY.md': 'docs/security/SECURITY.md',
  'docs/SECURITY_REMEDIATION_ROADMAP.md': 'docs/security/SECURITY_REMEDIATION_ROADMAP.md',
  'docs/TESTING.md': 'docs/testing/TESTING.md',
  'docs/DASHBOARD_AUDIT.md': 'docs/audits/DASHBOARD_AUDIT.md',
  'docs/DELIVERY_MODULE_AUDIT.md': 'docs/audits/DELIVERY_MODULE_AUDIT.md',
  'docs/MODULE_AUDIT.md': 'docs/audits/MODULE_AUDIT.md',
  'docs/PERFORMANCE.md': 'docs/audits/PERFORMANCE.md',
  'docs/PERFORMANCE_AUDIT.md': 'docs/audits/PERFORMANCE_AUDIT.md',
  'docs/RESPONSIVE_AUDIT.md': 'docs/audits/RESPONSIVE_AUDIT.md',
  'docs/FINANCIAL_REPORTING.md': 'docs/audits/FINANCIAL_REPORTING.md',
  'docs/BUGS_AND_DECISIONS.md': 'docs/bug-reports/BUGS_AND_DECISIONS.md',
  'docs/DEPLOYMENT_AND_RECOVERY.md': 'docs/deployment/DEPLOYMENT_AND_RECOVERY.md',
  'docs/release-checklist.md': 'docs/deployment/release-checklist.md',
  'docs/RELEASE_PROCESS.md': 'docs/deployment/RELEASE_PROCESS.md',

  // Root 7TIME_ files
  '7TIME_MULTI_ACCOUNT_ARCHITECTURE_AUDIT.md': 'docs/architecture/7TIME_MULTI_ACCOUNT_ARCHITECTURE_AUDIT.md',
  '7TIME_MULTI_ACCOUNT_SECURITY_DESIGN_REVIEW.md': 'docs/architecture/7TIME_MULTI_ACCOUNT_SECURITY_DESIGN_REVIEW.md',
  '7TIME_DATABASE_MIGRATION_05_REPORT.md': 'docs/database/7TIME_DATABASE_MIGRATION_05_REPORT.md',
  '7TIME_DATABASE_SECURITY_AUDIT.md': 'docs/database/7TIME_DATABASE_SECURITY_AUDIT.md',
  '7TIME_DELIVERY_MIGRATION_EXECUTION_EVIDENCE.md': 'docs/database/7TIME_DELIVERY_MIGRATION_EXECUTION_EVIDENCE.md',
  '7TIME_DELIVERY_MIGRATION_PRODUCTION_EXECUTION_REPORT.md': 'docs/database/7TIME_DELIVERY_MIGRATION_PRODUCTION_EXECUTION_REPORT.md',
  '7TIME_DELIVERY_MIGRATION_SECURITY_REVIEW.md': 'docs/database/7TIME_DELIVERY_MIGRATION_SECURITY_REVIEW.md',
  '7TIME_DELIVERY_MIGRATION_FINAL_SECURITY_REVIEW.md': 'docs/database/7TIME_DELIVERY_MIGRATION_FINAL_SECURITY_REVIEW.md',
  '7TIME_PRODUCTION_MIGRATION_41000_REPORT.md': 'docs/database/7TIME_PRODUCTION_MIGRATION_41000_REPORT.md',
  '7TIME_PRODUCTION_MIGRATION_READINESS_REPORT.md': 'docs/database/7TIME_PRODUCTION_MIGRATION_READINESS_REPORT.md',
  '7TIME_PRODUCTION_PRE_MIGRATION_BACKUP_REPORT.md': 'docs/database/7TIME_PRODUCTION_PRE_MIGRATION_BACKUP_REPORT.md',
  '7TIME_MIGRATION_DRIFT_AND_TEST_PROVENANCE_REPORT.md': 'docs/database/7TIME_MIGRATION_DRIFT_AND_TEST_PROVENANCE_REPORT.md',
  '7TIME_BACKUP_RESTORE_VERIFICATION_REPORT.md': 'docs/database/7TIME_BACKUP_RESTORE_VERIFICATION_REPORT.md',
  '7TIME_ROLLBACK_COMPLETENESS_REVIEW.md': 'docs/database/7TIME_ROLLBACK_COMPLETENESS_REVIEW.md',
  '7TIME_APPR01_SQL_EXECUTION_SAFETY_REVIEW.md': 'docs/database/7TIME_APPR01_SQL_EXECUTION_SAFETY_REVIEW.md',
  '7TIME_APPR02_WORKSPACE_INTEGRITY_CORRECTION.md': 'docs/database/7TIME_APPR02_WORKSPACE_INTEGRITY_CORRECTION.md',
  '7TIME_APPR03_GEMINI_AUTHORIZATION_CORRECTION.md': 'docs/database/7TIME_APPR03_GEMINI_AUTHORIZATION_CORRECTION.md',
  '7TIME_FINAL_REGRESSION_AND_SQL_REVIEW.md': 'docs/database/7TIME_FINAL_REGRESSION_AND_SQL_REVIEW.md',
  '7TIME_PRODUCTION_SECURITY_REMEDIATION_PLAN.md': 'docs/security/7TIME_PRODUCTION_SECURITY_REMEDIATION_PLAN.md',
  '7TIME_PRODUCTION_SECURITY_VERIFICATION.md': 'docs/security/7TIME_PRODUCTION_SECURITY_VERIFICATION.md',
  '7TIME_FINAL_PRE_PRODUCTION_SECURITY_REVIEW.md': 'docs/security/7TIME_FINAL_PRE_PRODUCTION_SECURITY_REVIEW.md',
  '7TIME_LOCAL_MULTI_ACCOUNT_INTEGRITY_TEST_REPORT.md': 'docs/security/7TIME_LOCAL_MULTI_ACCOUNT_INTEGRITY_TEST_REPORT.md',
  '7TIME_WORKSPACE_DEFAULTS_REVIEW.md': 'docs/security/7TIME_WORKSPACE_DEFAULTS_REVIEW.md',
  '7TIME_REGRESSION_TEST_REPORT.md': 'docs/testing/7TIME_REGRESSION_TEST_REPORT.md',
  '7TIME_FINAL_REGRESSION_TEST_REPORT.md': 'docs/testing/7TIME_FINAL_REGRESSION_TEST_REPORT.md',
  '7TIME_POST_AUDIT_VERIFICATION_REPORT.md': 'docs/testing/7TIME_POST_AUDIT_VERIFICATION_REPORT.md',
  '7TIME_PRODUCTION_SMOKE_TEST_REPORT.md': 'docs/testing/7TIME_PRODUCTION_SMOKE_TEST_REPORT.md',
  '7TIME_NAEEM_PAYMENT_OPERATIONAL_CHECKLIST.md': 'docs/testing/7TIME_NAEEM_PAYMENT_OPERATIONAL_CHECKLIST.md',
  '7TIME_COMPREHENSIVE_BUG_AUDIT.md': 'docs/audits/7TIME_COMPREHENSIVE_BUG_AUDIT.md',
  '7TIME_MASTER_BUG_REGISTER.md': 'docs/audits/7TIME_MASTER_BUG_REGISTER.md',
  '7TIME_IMPLEMENTATION_AUTHORIZATION_AND_CHANGE_AUDIT.md': 'docs/audits/7TIME_IMPLEMENTATION_AUTHORIZATION_AND_CHANGE_AUDIT.md',
  '7TIME_INDEPENDENT_PRODUCTION_RELEASE_VERIFICATION.md': 'docs/audits/7TIME_INDEPENDENT_PRODUCTION_RELEASE_VERIFICATION.md',
  '7TIME_DELIVERY_ENTRY_RLS_BUG_FIX_REPORT.md': 'docs/bug-reports/7TIME_DELIVERY_ENTRY_RLS_BUG_FIX_REPORT.md',
  '7TIME_TWO_DEFECT_REMEDIATION_REPORT.md': 'docs/bug-reports/7TIME_TWO_DEFECT_REMEDIATION_REPORT.md',
  '7TIME_FINAL_BUG_FIX_REPORT.md': 'docs/bug-reports/7TIME_FINAL_BUG_FIX_REPORT.md',
  '7TIME_EMERGENCY_PRODUCTION_STATE_REPORT.md': 'docs/bug-reports/7TIME_EMERGENCY_PRODUCTION_STATE_REPORT.md',
  '7TIME_NAEEM_DELIVERY_PRODUCTION_HOTFIX_REPORT.md': 'docs/bug-reports/7TIME_NAEEM_DELIVERY_PRODUCTION_HOTFIX_REPORT.md',
  '7TIME_NAEEM_FINAL_VERIFICATION.md': 'docs/bug-reports/7TIME_NAEEM_FINAL_VERIFICATION.md',
  '7TIME_NAEEM_PAYMENT_IDEMPOTENCY_RECOMMENDATION.md': 'docs/bug-reports/7TIME_NAEEM_PAYMENT_IDEMPOTENCY_RECOMMENDATION.md',
  '7TIME_NAEEM_PAYMENT_POST_DEPLOYMENT_VERIFICATION.md': 'docs/bug-reports/7TIME_NAEEM_PAYMENT_POST_DEPLOYMENT_VERIFICATION.md',
  '7TIME_FRONTEND_DEPLOYMENT_REPORT.md': 'docs/deployment/7TIME_FRONTEND_DEPLOYMENT_REPORT.md',
  '7TIME_EDGE_FUNCTION_DEPLOYMENT_REPORT.md': 'docs/deployment/7TIME_EDGE_FUNCTION_DEPLOYMENT_REPORT.md',
  '7TIME_PRODUCTION_DEPLOYMENT_PLAN.md': 'docs/deployment/7TIME_PRODUCTION_DEPLOYMENT_PLAN.md',
  '7TIME_PRODUCTION_READINESS_REPORT.md': 'docs/deployment/7TIME_PRODUCTION_READINESS_REPORT.md',
  '7TIME_FINAL_MASTER_DEPLOYMENT_REPORT.md': 'docs/deployment/7TIME_FINAL_MASTER_DEPLOYMENT_REPORT.md',
  '7TIME_BUG_FIX_CHANGELOG.md': 'docs/release-notes/7TIME_BUG_FIX_CHANGELOG.md',
  '7TIME_GIT_RELEASE_REPORT.md': 'docs/release-notes/7TIME_GIT_RELEASE_REPORT.md',
  '7TIME_FINAL_GIT_RELEASE_REPORT.md': 'docs/release-notes/7TIME_FINAL_GIT_RELEASE_REPORT.md',
  '7TIME_MASTER_COMPLETION_REPORT.md': 'docs/release-notes/7TIME_MASTER_COMPLETION_REPORT.md',
  '7TIME_SECURITY_FUNCTIONS_CORRECTION.sql': 'scripts/database/7TIME_SECURITY_FUNCTIONS_CORRECTION.sql',
  '7TIME_WORKSPACE_INTEGRITY_CORRECTION.sql': 'scripts/database/7TIME_WORKSPACE_INTEGRITY_CORRECTION.sql'
};

const preInventory = JSON.parse(fs.readFileSync('pre_reorganization_inventory.json', 'utf8'));
const hashMap = new Map(preInventory.map(item => [item.path, item.sha256]));

const verificationResults = [];

for (const [src, dst] of Object.entries(moves)) {
  const originalHash = hashMap.get(src);
  if (!originalHash) {
    console.warn('Warning: original hash not found in inventory for:', src);
  }
  
  // Try git mv first, fall back to fs.renameSync
  try {
    execSync(`git mv "${src}" "${dst}"`, { stdio: 'pipe' });
  } catch {
    fs.renameSync(src, dst);
    execSync(`git add "${dst}"`, { stdio: 'pipe' });
  }

  const postContent = fs.readFileSync(dst);
  const postHash = crypto.createHash('sha256').update(postContent).digest('hex');

  const match = (originalHash === postHash);
  verificationResults.push({
    src,
    dst,
    match,
    originalHash,
    postHash,
    size: postContent.length
  });

  if (!match) {
    console.error(`HASH MISMATCH on ${src} -> ${dst}!`);
  }
}

const allMatched = verificationResults.every(r => r.match);
console.log(`Executed ${verificationResults.length} moves. All SHA-256 hashes matched: ${allMatched}`);
fs.writeFileSync('move_verification_results.json', JSON.stringify(verificationResults, null, 2));
