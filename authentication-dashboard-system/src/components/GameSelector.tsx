import { useNavigate, useLocation } from 'react-router-dom';

const GAMES = [
  { path: '/casino/roulette', label: 'Roulette' },
  { path: '/casino/blackjack', label: 'Blackjack' },
];

export function GameSelector(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex gap-2">
      {GAMES.map((game) => {
        const isActive = location.pathname === game.path;
        return (
          <button
            key={game.path}
            onClick={() => !isActive && navigate(game.path)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-amber-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {game.label}
          </button>
        );
      })}
    </div>
  );
}
