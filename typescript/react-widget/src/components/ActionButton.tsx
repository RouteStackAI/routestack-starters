import { LoaderCircle, Search } from "lucide-react";

export function ActionButton({
  onClick,
  loading,
  disabled,
  icon: Icon,
  children,
  variant = 'primary'
}: {
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  icon: typeof Search;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'tertiary'
}) {
  return (
    <button
      type="button"
      className={variant === 'primary' ? 'primary-btn' : variant === 'secondary' ? 'secondary-btn' : 'tertiary-btn'}
      onClick={onClick}
      disabled={disabled}
    >
      {loading ? (
        <LoaderCircle className="size-4 animate-spin" />
      ) : (
        <Icon className="size-4" />
      )}
      {children}
    </button>
  );
}
