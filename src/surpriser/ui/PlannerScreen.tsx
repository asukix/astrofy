import { useState } from "preact/hooks";
import type { PlanSection } from "../data/board";
import { formatHuf } from "../format";
import type { Plan, PlanListKind } from "../model";
import { S } from "../strings";
import { Thumbnail } from "./components";
import { href } from "./router";

const KIND_LABEL: Record<PlanListKind, string> = {
  MINE: S.plannerKindMine,
  CHILD: S.plannerKindChild,
  SHARED: S.plannerKindShared,
};

/** The gift planner (PlannerScreen in the app): plans of every list I can edit, my own first. */
export function PlannerScreen({
  sections,
  onApprove,
}: {
  sections: PlanSection[];
  /** Approves a plan as it is; a plan without a price opens its editor instead. */
  onApprove: (plan: Plan) => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const approve = async (plan: Plan) => {
    if (busyId) return;
    setBusyId(plan.id);
    try {
      await onApprove(plan);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div class="flex flex-col gap-6">
      <p class="sp-hint text-sm pb-4">{S.plannerHint}</p>

      {sections.map(({ list, plans }) => (
        <section key={list.ownerId} class="sp-card">
          <header class="flex items-center gap-3 px-4 pt-4 pb-2">
            <div class="min-w-0 flex-1">
              <h2 class="sp-card__name">{list.name}</h2>
              <p class="sp-card__sub">{KIND_LABEL[list.kind]}</p>
            </div>
            <a href={href.newPlan(list.ownerId)} class="btn btn-ghost btn-sm text-primary shrink-0">
              {S.plannerAddShort}
            </a>
          </header>
          {plans.length === 0 ? (
            <p class="sp-card__empty">{S.plannerSectionEmpty}</p>
          ) : (
            <ul class="sp-wishlist">
              {plans.map((plan) => (
                <li key={plan.id}>
                  <div class="sp-wish">
                    <a href={href.editPlan(plan.id)} class="sp-wish__link">
                      <Thumbnail url={plan.imageUrl} />
                      <span class="min-w-0 flex-1">
                        <span class="sp-wish__name">{plan.name}</span>
                        <span class="sp-wish__meta">
                          <span class="sp-price">{plan.priceHuf !== null ? formatHuf(plan.priceHuf) : S.plannerNoPrice}</span>
                        </span>
                      </span>
                    </a>
                    <button
                      type="button"
                      class="btn btn-outline btn-primary btn-sm shrink-0"
                      disabled={busyId !== null}
                      onClick={() => approve(plan)}
                    >
                      {busyId === plan.id && <span class="loading loading-spinner loading-xs" />}
                      {S.plannerApprove}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <a href={href.newPlan()} class="btn btn-primary">
        {S.plannerAdd}
      </a>
    </div>
  );
}
