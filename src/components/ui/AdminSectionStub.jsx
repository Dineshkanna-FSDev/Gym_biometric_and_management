import StatusBadge from './StatusBadge';

/**
 * Shared placeholder layout for upcoming admin modules so every sidebar
 * route renders a clean header, action controls, and planned capabilities.
 */
export default function AdminSectionStub({
  title,
  description,
  badgeText = 'Phase 5–6 Module',
  primaryActionLabel,
  primaryActionIcon: PrimaryIcon,
  secondaryActionLabel,
  secondaryActionIcon: SecondaryIcon,
  highlights = [],
}) {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {title}
            </h1>
            <StatusBadge variant="info">{badgeText}</StatusBadge>
          </div>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {secondaryActionLabel && (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50"
            >
              {SecondaryIcon && <SecondaryIcon className="h-4 w-4 text-slate-500" />}
              <span>{secondaryActionLabel}</span>
            </button>
          )}
          {primaryActionLabel && (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-500"
            >
              {PrimaryIcon && <PrimaryIcon className="h-4 w-4" />}
              <span>{primaryActionLabel}</span>
            </button>
          )}
        </div>
      </div>

      {/* Highlights Grid */}
      {highlights.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {highlights.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
              >
                {Icon && (
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <Icon className="h-4 w-4" />
                  </span>
                )}
                <h2 className="mt-3 text-sm font-bold text-slate-900">{item.title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Workspace Skeleton Container */}
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="text-sm font-semibold text-slate-700">
          {title} Workspace Ready for Supabase Integration
        </p>
        <p className="mx-auto mt-1 max-w-lg text-xs text-slate-500">
          Routing, authentication guards, and layout scaffolding are active. Live PostgreSQL queries and actions will be wired in the upcoming phase.
        </p>
      </div>
    </div>
  );
}
