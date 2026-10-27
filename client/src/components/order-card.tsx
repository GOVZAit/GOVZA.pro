import { CheckCircle2, Clock, MapPinned, MessageCircle, Navigation, RotateCcw, Star } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Order, Master, OrderStatus } from "@shared/schema";

interface OrderCardProps {
  order: Order;
  master: Master | undefined;
  onLeaveReview?: () => void;
  onOpenChat?: () => void;
  onRepeatOrder?: () => void;
}

const statusConfig: Record<OrderStatus, { label: string; variant: "default" | "secondary" | "outline" }> = {
  completed: { label: 'Выполнен', variant: 'default' },
  in_progress: { label: 'В работе', variant: 'secondary' },
  pending: { label: 'Ожидает', variant: 'outline' },
  rejected: { label: 'Отклонён', variant: 'outline' },
};

export function OrderCard({ order, master, onLeaveReview, onOpenChat, onRepeatOrder }: OrderCardProps) {
  const status = statusConfig[order.status];

  return (
    <div
      data-testid={`order-card-${order.id}`}
      className="bg-card rounded-[22px] p-4"
    >
      <div className="flex items-center gap-3 mb-3">
        <Avatar className="w-12 h-12 rounded-xl">
          <AvatarImage src={master?.avatar} alt={master?.name} className="object-cover" />
          <AvatarFallback className="rounded-xl">
            {master?.name?.slice(0, 2) || '??'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{order.title}</p>
          <p className="text-sm text-muted-foreground truncate">{master?.name}</p>
        </div>
        <Badge
          variant={status.variant}
          className={
            order.status === 'completed'
              ? 'bg-muted text-foreground'
              : order.status === 'in_progress'
              ? 'directory-available'
              : ''
          }
        >
          {status.label}
        </Badge>
      </div>

      {(order.status === 'pending' || order.status === 'in_progress') && (
        <div className="mb-3" aria-label="Этапы заказа">
          <div className="order-steps" aria-hidden="true">
            {[1, 2, 3, 4].map((step) => {
              const done = order.status === 'pending' ? 1 : order.travelStatus === 'arrived' ? 4 : order.travelStatus === 'en_route' ? 3 : 2;
              return <span key={step} className={step <= done ? 'is-done' : undefined} />;
            })}
          </div>
          <ol className="order-steps-labels">
            <li>Отправлен</li><li>Принят</li><li>В пути</li><li>На месте</li>
          </ol>
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          {order.date}
        </span>
        <span className="font-bold">{order.price}</span>
      </div>

      {order.status === 'in_progress' && order.travelStatus === 'en_route' && (
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[.05] p-3">
          <div className="flex items-center gap-2 text-sm font-extrabold text-primary">
            <Navigation className="h-4 w-4" />
            Мастер в пути
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Мастер отметил, что выехал к вам.
          </p>
          {order.liveLocationUrl && (
            <a
              href={order.liveLocationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground"
            >
              <MapPinned className="h-4 w-4" />
              Отслеживать на карте
            </a>
          )}
        </div>
      )}

      {order.status === 'in_progress' && order.travelStatus === 'arrived' && (
        <div className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500/10 px-3 text-sm font-bold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          Мастер прибыл
        </div>
      )}

      {onOpenChat && order.status !== 'rejected' && (
        <Button
          variant="outline"
          onClick={onOpenChat}
          className="w-full mt-4"
          data-testid={`button-chat-${order.id}`}
        >
          <MessageCircle className="w-4 h-4 mr-2" />
          Написать мастеру
        </Button>
      )}

      {order.status === 'completed' && onLeaveReview && (
        <Button
          variant="outline"
          onClick={onLeaveReview}
          className="w-full mt-4 text-amber-600 border-amber-200 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-900/20"
          data-testid={`button-review-${order.id}`}
        >
          <Star className="w-4 h-4 mr-2 fill-amber-400 text-amber-400" />
          Оставить отзыв
        </Button>
      )}

      {order.status === 'completed' && onRepeatOrder && (
        <Button
          onClick={onRepeatOrder}
          className="w-full mt-4"
          data-testid={`button-repeat-order-${order.id}`}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Повторить заказ
        </Button>
      )}
    </div>
  );
}
