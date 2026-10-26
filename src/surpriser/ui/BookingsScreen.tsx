import type { BookedItem } from "../data/board";
import { formatHuf } from "../format";
import { S } from "../strings";
import { Spinner, Thumbnail, WishRow } from "./components";

export function BookingsScreen({ items, loading }: { items: BookedItem[]; loading: boolean }) {
  if (loading && items.length === 0) return <Spinner />;
  if (items.length === 0) return <p class="sp-empty">{S.bookingsEmpty}</p>;

  const total = items.reduce((sum, item) => sum + (item.wish && !item.wish.isReceived ? item.wish.priceHuf : 0), 0);

  return (
    <div class="flex flex-col gap-4">
      <ul class="sp-card sp-wishlist">
        {items.map((item) => (
          <li key={item.booking.wishId}>
            {item.wish ? (
              <WishRow wish={item.wish} meta={item.ownerName ?? S.unknownOwner} inBookings />
            ) : (
              // The owner's list is no longer visible: only the fact of the booking is left.
              <div class="sp-wish sp-wish--taken">
                <Thumbnail url={null} />
                <span class="sp-wish__name">{S.unknownOwner}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
      {total > 0 && <p class="text-right font-semibold pr-2">{S.bookingsTotal(formatHuf(total))}</p>}
    </div>
  );
}
