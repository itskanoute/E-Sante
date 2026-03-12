import React, { useState } from 'react';
import styled from 'styled-components';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';
import { User, Mail, Lock, Activity, Phone, ArrowRight, Pill, BellRing, BarChart3, ScanLine } from 'lucide-react';

const PageWrapper = styled.div`
  min-height: 100vh;
  display: flex;
  background: ${({ theme }) => theme.colors.background};
`;

const LeftPanel = styled.div`
  flex: 1;
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.primary[500]} 0%, ${({ theme }) => theme.colors.primary[700]} 50%, #1a1a4e 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: ${({ theme }) => theme.spacing[10]};
  color: white;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    width: 500px;
    height: 500px;
    border-radius: 50%;
    background: rgba(255,255,255,0.05);
    top: -100px;
    right: -100px;
  }

  &::after {
    content: '';
    position: absolute;
    width: 300px;
    height: 300px;
    border-radius: 50%;
    background: rgba(255,255,255,0.03);
    bottom: -50px;
    left: -50px;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    display: none;
  }
`;

const BrandContent = styled.div`
  text-align: center;
  z-index: 1;
  max-width: 400px;
  animation: fadeInUp 0.6s ease both;
`;

const BrandTitle = styled.h1`
  font-size: ${({ theme }) => theme.typography.sizes['4xl']};
  font-weight: ${({ theme }) => theme.typography.weights.bold};
  margin-bottom: ${({ theme }) => theme.spacing[4]};
`;

const BrandSubtitle = styled.p`
  font-size: ${({ theme }) => theme.typography.sizes.lg};
  opacity: 0.85;
  line-height: ${({ theme }) => theme.typography.lineHeights.relaxed};
`;

const Features = styled.div`
  margin-top: ${({ theme }) => theme.spacing[8]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[3]};
`;

const Feature = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  font-size: ${({ theme }) => theme.typography.sizes.sm};
  opacity: 0.9;

  span {
    width: 32px;
    height: 32px;
    border-radius: ${({ theme }) => theme.radii.md};
    background: rgba(255,255,255,0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
  }
`;

const RightPanel = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing[6]};
  overflow-y: auto;
`;

const FormCard = styled.div`
  width: 100%;
  max-width: 480px;
  animation: fadeIn 0.5s ease both;
`;

const LogoMobile = styled.div`
  display: none;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  margin-bottom: ${({ theme }) => theme.spacing[6]};

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    display: flex;
  }
`;

const LogoIconSmall = styled.div`
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.radii.lg};
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.primary[500]}, ${({ theme }) => theme.colors.primary[600]});
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  svg { width: 22px; height: 22px; }
`;

const FormTitle = styled.h2`
  font-size: ${({ theme }) => theme.typography.sizes['2xl']};
  font-weight: ${({ theme }) => theme.typography.weights.bold};
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: ${({ theme }) => theme.spacing[1]};
`;

const FormSubtitle = styled.p`
  font-size: ${({ theme }) => theme.typography.sizes.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: ${({ theme }) => theme.spacing[6]};
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[4]};
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing[3]};

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: 1fr;
  }
`;

const BottomText = styled.p`
  text-align: center;
  font-size: ${({ theme }) => theme.typography.sizes.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-top: ${({ theme }) => theme.spacing[6]};

  a {
    color: ${({ theme }) => theme.colors.primary[500]};
    font-weight: ${({ theme }) => theme.typography.weights.semibold};
    &:hover { text-decoration: underline; }
  }
`;

export default function RegisterPage() {
    const navigate = useNavigate();
    const { register: registerUser } = useAuth();
    const [submitting, setSubmitting] = useState(false);
    const { register, handleSubmit, formState: { errors }, watch } = useForm();

    const onSubmit = async (formData) => {
        setSubmitting(true);
        try {
            await registerUser({
                nom: formData.nom,
                prenom: formData.prenom,
                email: formData.email,
                password: formData.password,
                telephone: formData.telephone,
                date_naissance: formData.dateNaissance,
            });
            toast.success('Compte créé avec succès !');
            navigate('/dashboard', { replace: true });
        } catch (err) {
            toast.error(err.response?.data?.message || 'Erreur lors de la création du compte');
        } finally {
            setSubmitting(false);
        }
    };

    const today = new Date().toISOString().split('T')[0];

    return (
        <PageWrapper>
            <LeftPanel>
                <BrandContent>
                    <BrandTitle>E-Santé</BrandTitle>
                    <BrandSubtitle>
                        Rejoignez E-Santé pour un meilleur suivi de vos traitements et de votre santé.
                    </BrandSubtitle>
                    <Features>
                        <Feature><span><Pill size={16} /></span> Suivi intelligent de vos médicaments</Feature>
                        <Feature><span><BellRing size={16} /></span> Rappels personnalisés aux bons moments</Feature>
                        <Feature><span><BarChart3 size={16} /></span> Statistiques d'observance détaillées</Feature>
                        <Feature><span><ScanLine size={16} /></span> Scanner d'ordonnances intégré</Feature>
                    </Features>
                </BrandContent>
            </LeftPanel>

            <RightPanel>
                <FormCard>
                    <LogoMobile>
                        <LogoIconSmall><Activity size={22} /></LogoIconSmall>
                        <span style={{ fontWeight: 700, fontSize: '1.25rem' }}>E-Santé</span>
                    </LogoMobile>

                    <FormTitle>Créer un compte</FormTitle>
                    <FormSubtitle>Rejoignez E-Santé pour un meilleur suivi de vos traitements.</FormSubtitle>

                    <Form onSubmit={handleSubmit(onSubmit)}>
                        <Row>
                            <Input
                                label="Prénom"
                                placeholder="Jean"
                                icon={User}
                                error={errors.prenom?.message}
                                {...register('prenom', { required: 'Le prénom est requis' })}
                            />
                            <Input
                                label="Nom"
                                placeholder="Dupont"
                                icon={User}
                                error={errors.nom?.message}
                                {...register('nom', { required: 'Le nom est requis' })}
                            />
                        </Row>

                        <Input
                            label="E-mail"
                            type="email"
                            placeholder="jean.dupont@email.com"
                            icon={Mail}
                            error={errors.email?.message}
                            {...register('email', {
                                required: 'L\'email est requis',
                                pattern: { value: /^\S+@\S+$/i, message: 'Email invalide' },
                            })}
                        />

                        <Input
                            label="Téléphone"
                            type="tel"
                            placeholder="+33 6 12 34 56 78"
                            icon={Phone}
                            error={errors.telephone?.message}
                            {...register('telephone')}
                        />

                        <Input
                            label="Date de naissance"
                            type="date"
                            max={today}
                            error={errors.dateNaissance?.message}
                            {...register('dateNaissance', {
                                required: 'La date de naissance est requise',
                                validate: (val) => {
                                    if (!val) return true;
                                    return val <= today || 'La date de naissance ne peut pas être dans le futur';
                                },
                            })}
                        />

                        <Input
                            label="Mot de passe"
                            type="password"
                            placeholder="Minimum 8 caractères"
                            icon={Lock}
                            error={errors.password?.message}
                            {...register('password', {
                                required: 'Le mot de passe est requis',
                                minLength: { value: 8, message: 'Minimum 8 caractères' },
                            })}
                        />

                        <Input
                            label="Confirmer le mot de passe"
                            type="password"
                            placeholder="••••••••"
                            icon={Lock}
                            error={errors.confirmPassword?.message}
                            {...register('confirmPassword', {
                                required: 'Confirmez le mot de passe',
                                validate: (val) => val === watch('password') || 'Les mots de passe ne correspondent pas',
                            })}
                        />

                        <Button type="submit" fullWidth disabled={submitting} iconRight={ArrowRight}>
                            {submitting ? 'Création…' : 'Créer mon compte'}
                        </Button>
                    </Form>

                    <BottomText>
                        Déjà un compte ? <Link to="/login">Se connecter</Link>
                    </BottomText>
                </FormCard>
            </RightPanel>
        </PageWrapper>
    );
}
