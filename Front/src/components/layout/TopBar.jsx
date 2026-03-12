import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePrisesToday } from '../../hooks/usePrises';
import { getTodayFormatted, getGreeting } from '../../utils/helpers';
import { Bell, Menu, Search, Pill, ChevronRight } from 'lucide-react';

const TopBarContainer = styled.header`
  height: 68px;
  background: ${({ theme }) => theme.colors.surface};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 ${({ theme }) => theme.spacing[6]};
  position: sticky;
  top: 0;
  z-index: ${({ theme }) => theme.zIndex.topbar};
  backdrop-filter: blur(12px);
  background: rgba(255, 255, 255, 0.9);
`;

const LeftSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[4]};
`;

const MenuButton = styled.button`
  display: none;
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.radii.md};
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.textSecondary};

  &:hover {
    background: ${({ theme }) => theme.colors.neutral[100]};
  }

  svg { width: 20px; height: 20px; }

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    display: flex;
  }
`;

const GreetingBlock = styled.div`
  h2 {
    font-size: ${({ theme }) => theme.typography.sizes.md};
    font-weight: ${({ theme }) => theme.typography.weights.semibold};
    color: ${({ theme }) => theme.colors.text};
    margin: 0;
  }

  p {
    font-size: ${({ theme }) => theme.typography.sizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    margin: 0;
    text-transform: capitalize;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    p { display: none; }
  }
`;

const RightSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
`;

const SearchBar = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  background: ${({ theme }) => theme.colors.neutral[50]};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.full};
  padding: 8px 16px;
  min-width: 220px;
  transition: all ${({ theme }) => theme.transitions.fast};

  &:focus-within {
    border-color: ${({ theme }) => theme.colors.borderFocus};
    box-shadow: ${({ theme }) => theme.shadows.focus};
    background: ${({ theme }) => theme.colors.surface};
  }

  svg {
    width: 16px;
    height: 16px;
    color: ${({ theme }) => theme.colors.textMuted};
    flex-shrink: 0;
  }

  input {
    border: none;
    outline: none;
    background: transparent;
    font-size: ${({ theme }) => theme.typography.sizes.sm};
    color: ${({ theme }) => theme.colors.text};
    width: 100%;

    &::placeholder {
      color: ${({ theme }) => theme.colors.textMuted};
    }
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    display: none;
  }
`;

const IconButton = styled.button`
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.radii.md};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  position: relative;
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.neutral[100]};
    color: ${({ theme }) => theme.colors.text};
  }

  svg { width: 20px; height: 20px; }
`;

const NotifDot = styled.span`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.danger[500]};
  border: 2px solid ${({ theme }) => theme.colors.surface};
`;

const NotifWrapper = styled.div`
  position: relative;
`;

const NotifPanel = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 320px;
  max-height: 400px;
  overflow-y: auto;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.radii.xl};
  box-shadow: ${({ theme }) => theme.shadows.xl};
  border: 1px solid ${({ theme }) => theme.colors.border};
  z-index: ${({ theme }) => theme.zIndex?.dropdown ?? 1000};
  animation: fadeIn 0.2s ease both;
`;

const NotifPanelHeader = styled.div`
  padding: ${({ theme }) => theme.spacing[4]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  font-weight: 600;
  font-size: ${({ theme }) => theme.typography.sizes.sm};
  color: ${({ theme }) => theme.colors.text};
`;

const NotifItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[3]} ${({ theme }) => theme.spacing[4]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  font-size: ${({ theme }) => theme.typography.sizes.sm};
  color: ${({ theme }) => theme.colors.text};

  &:last-child {
    border-bottom: none;
  }
  svg:first-child {
    width: 18px;
    height: 18px;
    color: ${({ theme }) => theme.colors.primary[500]};
    flex-shrink: 0;
  }
`;

const NotifFooter = styled.div`
  padding: ${({ theme }) => theme.spacing[3]} ${({ theme }) => theme.spacing[4]};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const NotifLink = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[3]};
  background: ${({ theme }) => theme.colors.primary[50]};
  border: none;
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: ${({ theme }) => theme.typography.sizes.sm};
  font-weight: 500;
  color: ${({ theme }) => theme.colors.primary[600]};
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.primary[100]};
  }
  svg {
    width: 18px;
    height: 18px;
  }
`;

const NotifEmpty = styled.p`
  padding: ${({ theme }) => theme.spacing[4]};
  font-size: ${({ theme }) => theme.typography.sizes.sm};
  color: ${({ theme }) => theme.colors.textMuted};
  margin: 0;
  text-align: center;
`;

export default function TopBar({ onMenuToggle }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const notifRef = useRef(null);
  const [searchValue, setSearchValue] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);

  const { data: prisesAujourdhui } = usePrisesToday();
  const prisesEnAttente = Array.isArray(prisesAujourdhui)
    ? prisesAujourdhui.filter((p) => p.statut === 'en_attente')
    : [];
  const hasPrisesEnAttente = prisesEnAttente.length > 0;
  const greeting = getGreeting();
  const today = getTodayFormatted();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    if (notifOpen) document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [notifOpen]);

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchValue.trim();
    if (q) {
      navigate(`/medications?q=${encodeURIComponent(q)}`);
      setSearchValue('');
    } else {
      navigate('/medications');
    }
  };

  return (
    <TopBarContainer>
      <LeftSection>
        <MenuButton onClick={onMenuToggle} aria-label="Menu">
          <Menu />
        </MenuButton>
        <GreetingBlock>
          <h2>{greeting}, {user?.prenom || 'Patient'}</h2>
          <p>{today}</p>
        </GreetingBlock>
      </LeftSection>

      <RightSection>
        <form onSubmit={handleSearch} style={{ display: 'flex' }}>
          <SearchBar>
            <Search size={16} />
            <input
              placeholder="Rechercher un médicament…"
              aria-label="Rechercher un médicament"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </SearchBar>
        </form>

        <NotifWrapper ref={notifRef}>
          <IconButton
            type="button"
            aria-label="Notifications"
            aria-expanded={notifOpen}
            title={hasPrisesEnAttente ? 'Prises en attente aujourd\'hui' : 'Notifications'}
            onClick={() => setNotifOpen((o) => !o)}
          >
            <Bell size={20} />
            {hasPrisesEnAttente && <NotifDot />}
          </IconButton>

          {notifOpen && (
            <NotifPanel>
              <NotifPanelHeader>
                {hasPrisesEnAttente
                  ? `${prisesEnAttente.length} prise${prisesEnAttente.length > 1 ? 's' : ''} à confirmer`
                  : 'Notifications'}
              </NotifPanelHeader>
              {prisesEnAttente.length > 0 ? (
                <>
                  {prisesEnAttente.slice(0, 8).map((p) => (
                    <NotifItem key={p.prise_programmee_id || p.id || Math.random()}>
                      <Pill size={18} />
                      <span>
                        {p.nom_medicament}
                        {p.dosage ? ` — ${p.dosage}` : ''}
                        {p.heure_prevue ? ` (${String(p.heure_prevue).slice(0, 5)})` : ''}
                      </span>
                    </NotifItem>
                  ))}
                  <NotifFooter>
                    <NotifLink type="button" onClick={() => { setNotifOpen(false); navigate('/prises'); }}>
                      Voir les prises du jour
                      <ChevronRight size={18} />
                    </NotifLink>
                  </NotifFooter>
                </>
              ) : (
                <NotifEmpty>Aucune prise en attente pour aujourd&apos;hui.</NotifEmpty>
              )}
            </NotifPanel>
          )}
        </NotifWrapper>
      </RightSection>
    </TopBarContainer>
  );
}
