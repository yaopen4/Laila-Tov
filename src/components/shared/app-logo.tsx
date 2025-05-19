import type { FC } from 'react';

interface AppLogoProps {
  className?: string;
}

const AppLogo: FC<AppLogoProps> = ({ className }) => {
  return (
    <div className={`text-3xl font-bold text-primary ${className}`}>
      <span>לילה</span> <span className="text-accent">טוב</span>
    </div>
  );
};

export default AppLogo;
