import React, { useRef, useState } from 'react';
import styled from 'styled-components';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import Spinner from '../components/ui/Spinner';
import ErrorState from '../components/ui/ErrorState';
import Modal from '../components/ui/Modal';
import { useOrdonnances, useScanOrdonnance, useValiderOrdonnance } from '../hooks/useOrdonnances';
import toast from 'react-hot-toast';
import {
  UploadCloud, FileText, Eye, ScanLine,
  FolderOpen, CalendarDays, CheckCircle, ImageOff, Smile,
} from 'lucide-react';

// URL de base du backend (sans /api) pour les images ; en dev on utilise le proxy (origine relative)
const getApiBaseUrl = () => {
  const url = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  const base = url.replace(/\/api\/?$/, '') || 'http://localhost:3000';
  return base.endsWith('/') ? base.slice(0, -1) : base;
};

const getImageUrl = (imageUrl) => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  const base = getApiBaseUrl();
  const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
  return `${base}${path}`;
};

/* ─── Styles ─── */
const PageHeader = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing[6]};
  animation: fadeIn 0.4s ease both;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
`;

const TitleIcon = styled.span`
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.radii.lg};
  background: linear-gradient(135deg, #8B5CF6, #7C3AED);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
  svg { width: 20px; height: 20px; }
`;

const TitleText = styled.div`
  h1 { font-size: ${({ theme }) => theme.typography.sizes['2xl']}; font-weight: ${({ theme }) => theme.typography.weights.bold}; color: ${({ theme }) => theme.colors.text}; margin: 0 0 2px; }
  p { font-size: ${({ theme }) => theme.typography.sizes.sm}; color: ${({ theme }) => theme.colors.textSecondary}; margin: 0; }
`;

const UploadZone = styled.div`
  border: 2px dashed ${({ theme, $dragging }) => $dragging ? theme.colors.primary[400] : theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.xl};
  padding: ${({ theme }) => theme.spacing[10]};
  text-align: center;
  background: ${({ theme, $dragging }) => $dragging ? theme.colors.primary[50] : theme.colors.neutral[50]};
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.fast};
  margin-bottom: ${({ theme }) => theme.spacing[6]};
  animation: fadeInUp 0.4s ease both;
  animation-delay: 0.1s;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary[400]};
    background: ${({ theme }) => theme.colors.primary[50]};
  }
`;

const UploadIconCircle = styled.div`
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.primary[100]}, ${({ theme }) => theme.colors.primary[200]});
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto ${({ theme }) => theme.spacing[4]};
  color: ${({ theme }) => theme.colors.primary[500]};
  svg { width: 28px; height: 28px; }
`;

const UploadTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.sizes.md};
  font-weight: ${({ theme }) => theme.typography.weights.semibold};
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: ${({ theme }) => theme.spacing[1]};
`;

const UploadDesc = styled.p`
  font-size: ${({ theme }) => theme.typography.sizes.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: ${({ theme }) => theme.spacing[3]};
`;

const Formats = styled.span`
  font-size: ${({ theme }) => theme.typography.sizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const SectionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  margin-bottom: ${({ theme }) => theme.spacing[4]};
  h3 { font-size: ${({ theme }) => theme.typography.sizes.md}; font-weight: ${({ theme }) => theme.typography.weights.semibold}; color: ${({ theme }) => theme.colors.text}; margin: 0; }
  svg { width: 20px; height: 20px; color: ${({ theme }) => theme.colors.primary[500]}; }
`;

const OrdoList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[3]};
`;

const OrdoCard = styled(Card)`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[4]};
  animation-delay: ${({ $delay }) => $delay};
`;

const OrdoIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.warning[50]};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.warning[600]};
  flex-shrink: 0;
  svg { width: 22px; height: 22px; }
`;

const OrdoInfo = styled.div`
  flex: 1;
  min-width: 0;
  h4 { font-size: ${({ theme }) => theme.typography.sizes.sm}; font-weight: ${({ theme }) => theme.typography.weights.semibold}; color: ${({ theme }) => theme.colors.text}; margin: 0; word-break: break-all; }
  p { font-size: ${({ theme }) => theme.typography.sizes.xs}; color: ${({ theme }) => theme.colors.textMuted}; margin: 2px 0 0; display: flex; align-items: center; gap: 4px; }
  p svg { width: 12px; height: 12px; }
`;

const MedsList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: ${({ theme }) => theme.spacing[1]};
`;

const OrdoActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing[2]};
  flex-shrink: 0;
`;

const ScanImage = styled.img`
  width: 100%;
  max-height: 70vh;
  object-fit: contain;
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.neutral[100]};
`;

const NoImagePlaceholder = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing[8]};
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.primary[50]} 0%, ${({ theme }) => theme.colors.warning[50]} 100%);
  border-radius: ${({ theme }) => theme.radii.xl};
  border: 1px dashed ${({ theme }) => theme.colors.primary[200]};
`;

const NoImageIconWrap = styled.div`
  width: 80px;
  height: 80px;
  margin: 0 auto ${({ theme }) => theme.spacing[4]};
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.primary[400]};
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  svg { width: 40px; height: 40px; }
`;

const NoImageTitle = styled.p`
  font-size: ${({ theme }) => theme.typography.sizes.lg};
  font-weight: ${({ theme }) => theme.typography.weights.semibold};
  color: ${({ theme }) => theme.colors.text};
  margin: 0 0 ${({ theme }) => theme.spacing[2]};
`;

const NoImageText = styled.p`
  font-size: ${({ theme }) => theme.typography.sizes.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  max-width: 320px;
  margin-left: auto;
  margin-right: auto;
`;

/* ─── Helpers ─── */
function getStatutInfo(statut) {
  switch (statut) {
    case 'validee': case 'traitee': return { label: 'Traitée', color: 'success' };
    case 'en_cours': case 'en_attente': return { label: 'En attente', color: 'warning' };
    case 'rejetee': return { label: 'Rejetée', color: 'danger' };
    default: return { label: statut || 'En attente', color: 'warning' };
  }
}

function formatOrdoDate(ordo) {
  const d = ordo.date_scan || ordo.date || ordo.created_at;
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getMedicamentLabels(ordo) {
  if (ordo.medicaments_extraits && ordo.medicaments_extraits.length > 0) {
    return ordo.medicaments_extraits;
  }
  const meds = ordo.donnees_parsees?.medicaments || [];
  return meds.map((m) => (typeof m === 'string' ? m : m.nom)).filter(Boolean);
}

/* ─── Component ─── */
export default function OrdonnancePage() {
  const fileInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [ordonnanceEnCours, setOrdonnanceEnCours] = useState(null);
  const [imageErreur, setImageErreur] = useState(false);

  const { data: ordonnances, isLoading, error } = useOrdonnances();
  const scanMutation = useScanOrdonnance();
  const validerMutation = useValiderOrdonnance();

  const handleValider = (ordoId) => {
    validerMutation.mutate({ id: ordoId, corrections: [] }, {
      onSuccess: () => toast.success('Ordonnance validée — traitements créés !'),
      onError: (err) => toast.error(err.response?.data?.message || 'Erreur lors de la validation'),
    });
  };

  const allOrdonnances = Array.isArray(ordonnances) ? ordonnances : [];

  const handleUpload = (files) => {
    if (files && files.length > 0) {
      scanMutation.mutate(files[0], {
        onSuccess: (data) => {
          const ordo = data?.data || data;
          const medicaments = ordo?.donnees_parsees?.medicaments || [];
          const n = medicaments.length;
          if (n > 0) {
            toast.success(`${n} médicament(s) extrait(s). Cliquez sur « Valider » sur l’ordonnance pour les ajouter à Mes traitements.`, { duration: 6000 });
          } else if (ordo?.donnees_parsees?.raison_aucun_medicament === 'service_ia_indisponible') {
            toast.error('Service Medical AI non démarré. Terminal : cd IA_E-Sante/medical-ai puis node server.js. Puis glissez à nouveau l\'image pour rescanner.', { duration: 12000 });
          } else {
            toast.success('Ordonnance enregistrée. Aucun médicament détecté — validez ou rescanner après avoir démarré le service IA.', { duration: 7000 });
          }
        },
        onError: (err) => {
          toast.error(err.response?.data?.message || 'Erreur lors du scan de l\'ordonnance');
        },
      });
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleUpload(e.dataTransfer.files);
  };

  if (isLoading) return <Spinner text="Chargement des ordonnances…" />;
  if (error) return <ErrorState title="Erreur" message="Impossible de charger les ordonnances." onRetry={() => window.location.reload()} />;

  return (
    <>
      <PageHeader>
        <TitleIcon><ScanLine /></TitleIcon>
        <TitleText>
          <h1>Ordonnances</h1>
          <p>Scannez et gérez vos ordonnances médicales</p>
        </TitleText>
      </PageHeader>

      <UploadZone
        $dragging={dragging}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input ref={fileInputRef} type="file" accept="image/*,.pdf" hidden onChange={(e) => handleUpload(e.target.files)} />
        <UploadIconCircle><UploadCloud /></UploadIconCircle>
        <UploadTitle>{scanMutation.isPending ? 'Scan en cours…' : 'Glissez votre ordonnance ici'}</UploadTitle>
        <UploadDesc>ou cliquez pour parcourir vos fichiers</UploadDesc>
        <Formats>Formats acceptés : JPG, PNG, PDF — Max 10 Mo</Formats>
      </UploadZone>

      <SectionTitle>
        <FolderOpen />
        <h3>Ordonnances récentes</h3>
      </SectionTitle>

      {allOrdonnances.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucune ordonnance"
          description="Scannez ou uploadez votre première ordonnance pour commencer."
        />
      ) : (
        <OrdoList>
          {allOrdonnances.map((ordo, index) => {
            const statutInfo = getStatutInfo(ordo.statut);
            const medicaments = getMedicamentLabels(ordo);
            return (
              <OrdoCard key={ordo.id} hoverable $delay={`${0.05 * (index + 1)}s`}>
                <OrdoIcon><FileText /></OrdoIcon>
                <OrdoInfo>
                  <h4>Ordonnance #{ordo.id}</h4>
                  <p>
                    <CalendarDays />
                    Importée le {formatOrdoDate(ordo)}
                  </p>
                  {medicaments.length > 0 && (
                    <MedsList>
                      {medicaments.map((m, i) => (
                        <Badge key={i} color="primary" size="sm">{m}</Badge>
                      ))}
                    </MedsList>
                  )}
                </OrdoInfo>
                <Badge color={statutInfo.color} dot>
                  {statutInfo.label}
                </Badge>
                <OrdoActions>
                  {(ordo.statut === 'en_cours' || ordo.statut === 'en_attente' || !ordo.statut) && (
                    <Button
                      size="sm"
                      variant="success"
                      icon={CheckCircle}
                      onClick={() => handleValider(ordo.id)}
                      disabled={validerMutation.isPending}
                      title="Marquer comme validée et créer les traitements si des médicaments ont été extraits"
                    >
                      Valider
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Eye}
                    onClick={() => { setOrdonnanceEnCours(ordo); setImageErreur(false); }}
                    title="Voir le scan"
                  />
                </OrdoActions>
              </OrdoCard>
            );
          })}
        </OrdoList>
      )}

      <Modal
        isOpen={!!ordonnanceEnCours}
        onClose={() => { setOrdonnanceEnCours(null); setImageErreur(false); }}
        title="Scan de l'ordonnance"
        maxWidth="720px"
      >
        {ordonnanceEnCours && (
          <>
            {ordonnanceEnCours.image_url && !imageErreur ? (
              <ScanImage
                src={getImageUrl(ordonnanceEnCours.image_url)}
                alt="Scan de l'ordonnance"
                onError={() => setImageErreur(true)}
              />
            ) : (
              <NoImagePlaceholder>
                <NoImageIconWrap>
                  {ordonnanceEnCours.image_url && imageErreur ? <ImageOff /> : <Smile />}
                </NoImageIconWrap>
                <NoImageTitle>
                  {ordonnanceEnCours.image_url && imageErreur
                    ? "Oups, l'image ne s'affiche pas"
                    : "Pas d'image pour cette ordonnance"}
                </NoImageTitle>
                <NoImageText>
                  {ordonnanceEnCours.image_url && imageErreur
                    ? "Le serveur ou le fichier n'est peut-être pas disponible. Réessayez plus tard."
                    : "Tu peux ajouter un scan plus tard en modifiant l'ordonnance."}
                </NoImageText>
              </NoImagePlaceholder>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
