import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Shield, Users, Settings } from 'lucide-react';
import { usePrefs } from '../contexts/PrefsContext';
import { t } from '../lib/i18n';

export default function BottomTabs() {
  const { lang } = usePrefs();
  const items = [
    { to: '/', label: t(lang, 'tabHome'), Icon: Home },
    { to: '/safewalk', label: t(lang, 'tabSafeWalk'), Icon: Shield },
    { to: '/circle', label: t(lang, 'tabCircle'), Icon: Users },
    { to: '/settings', label: t(lang, 'tabSettings'), Icon: Settings }
  ];

  return (
    <div className="tabs safe-pad safe-bottom">
      <div className="tabs-inner glass neon-outline">
        {items.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => (isActive ? 'tab active' : 'tab')}
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
