import { AppUser } from "./types";

/**
 * Módulo Centralizado de Autorização e Permissões do Sistema
 */

/**
 * Obtém o usuário autenticado atualmente a partir do sessionStorage.
 */
export const getCurrentUser = (): AppUser | null => {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem("acandido_app_user");
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user && typeof user === "object" ? (user as AppUser) : null;
  } catch {
    return null;
  }
};

/**
 * Resolve o usuário de contexto (parâmetro fornecido ou usuário logado na sessão).
 */
const resolveUser = (user?: AppUser | null): AppUser | null => {
  if (user) return user;
  return getCurrentUser();
};

/**
 * Exige perfil ADMIN. Lança erro se não for Administrador.
 */
export const requireAdmin = (user?: AppUser | null): AppUser => {
  const activeUser = resolveUser(user);
  if (!activeUser || activeUser.role !== "ADMIN") {
    throw new Error("Acesso negado: Esta operação requer perfil de Administrador.");
  }
  return activeUser;
};

/**
 * Exige perfil SUPERVISOR. Lança erro se não for Supervisor.
 */
export const requireSupervisor = (user?: AppUser | null): AppUser => {
  const activeUser = resolveUser(user);
  if (!activeUser || activeUser.role !== "SUPERVISOR") {
    throw new Error("Acesso negado: Esta operação requer perfil de Supervisor.");
  }
  return activeUser;
};

/**
 * Exige perfil ADMIN ou SUPERVISOR. Lança erro se não for um dos dois.
 */
export const requireAdminOrSupervisor = (user?: AppUser | null): AppUser => {
  const activeUser = resolveUser(user);
  if (!activeUser || (activeUser.role !== "ADMIN" && activeUser.role !== "SUPERVISOR")) {
    throw new Error("Acesso negado: Esta operação requer perfil de Administrador ou Supervisor.");
  }
  return activeUser;
};

/**
 * Exige perfil ALMOXARIFE. Lança erro se não for Almoxarife.
 */
export const requireAlmoxarife = (user?: AppUser | null): AppUser => {
  const activeUser = resolveUser(user);
  if (!activeUser || activeUser.role !== "ALMOXARIFE") {
    throw new Error("Acesso negado: Esta operação requer perfil de Almoxarife.");
  }
  return activeUser;
};

/**
 * Verifica se o usuário possui alguma das roles especificadas.
 */
export const hasRole = (user: AppUser | null | undefined, allowedRoles: string[]): boolean => {
  const activeUser = resolveUser(user);
  if (!activeUser || !activeUser.role) return false;
  return allowedRoles.includes(activeUser.role);
};

/**
 * Exige que o usuário tenha uma das roles informadas, caso contrário lança erro.
 */
export const requirePermission = (allowedRoles: string[], user?: AppUser | null): AppUser => {
  const activeUser = resolveUser(user);
  if (!activeUser || !activeUser.role) {
    throw new Error("Acesso negado: Usuário não autenticado no sistema.");
  }
  if (!allowedRoles.includes(activeUser.role)) {
    throw new Error(`Acesso negado: Perfil ${activeUser.role} não possui permissão para esta ação.`);
  }
  return activeUser;
};

/**
 * Verifica se o usuário tem permissão para acessar um determinado almoxarifado/filial.
 */
export const canAccessBranch = (user?: AppUser | null, branchId?: string): boolean => {
  const activeUser = resolveUser(user);
  if (!activeUser) return false;

  // ADMIN e SUPERVISOR têm acesso global a todos os almoxarifados
  if (activeUser.role === "ADMIN" || activeUser.role === "SUPERVISOR") {
    return true;
  }

  // Se não foi passado um branchId específico, libera visualização geral do seu escopo
  if (!branchId) return true;

  // Se for ALMOXARIFE, verifica a lista de almoxarifados associados ao seu perfil
  if (activeUser.almoxarifados && Array.isArray(activeUser.almoxarifados) && activeUser.almoxarifados.length > 0) {
    return activeUser.almoxarifados.includes(branchId);
  }

  // Fallback: se não tiver almoxarifados restritos cadastrados, permite por padrão
  return true;
};

/**
 * Verifica se o usuário pode gerenciar (cadastrar/editar/excluir) usuários.
 */
export const canManageUsers = (user?: AppUser | null): boolean => {
  const activeUser = resolveUser(user);
  return activeUser?.role === "ADMIN";
};

/**
 * Verifica se o usuário pode abrir ou fechar o ciclo mensal de avaliações.
 */
export const canCloseCycle = (user?: AppUser | null): boolean => {
  const activeUser = resolveUser(user);
  return activeUser?.role === "ADMIN";
};

/**
 * Verifica se o usuário pode alterar as configurações do sistema.
 */
export const canEditSettings = (user?: AppUser | null): boolean => {
  const activeUser = resolveUser(user);
  return activeUser?.role === "ADMIN";
};

/**
 * Verifica se o usuário pode excluir registros do histórico de auditoria.
 */
export const canDeleteHistory = (user?: AppUser | null): boolean => {
  const activeUser = resolveUser(user);
  return activeUser?.role === "ADMIN";
};

/**
 * Verifica se o usuário pode gerenciar itens de garantia em determinado almoxarifado.
 */
export const canManageWarranty = (user?: AppUser | null, branchId?: string): boolean => {
  const activeUser = resolveUser(user);
  if (!activeUser) return false;
  if (activeUser.role === "ADMIN" || activeUser.role === "SUPERVISOR") return true;
  if (activeUser.role === "ALMOXARIFE") return canAccessBranch(activeUser, branchId);
  return false;
};

/**
 * Verifica se o usuário pode gerenciar ocorrências de materiais (nível de serviço) em determinado almoxarifado.
 */
export const canManageOccurrences = (user?: AppUser | null, branchId?: string): boolean => {
  const activeUser = resolveUser(user);
  if (!activeUser) return false;
  if (activeUser.role === "ADMIN" || activeUser.role === "SUPERVISOR") return true;
  if (activeUser.role === "ALMOXARIFE") return canAccessBranch(activeUser, branchId);
  return false;
};

/**
 * Verifica se o usuário pode gerenciar certificados Unimobin.
 */
export const canManageCertificates = (user?: AppUser | null, branchId?: string): boolean => {
  const activeUser = resolveUser(user);
  if (!activeUser) return false;
  if (activeUser.role === "ADMIN" || activeUser.role === "SUPERVISOR") return true;
  if (activeUser.role === "ALMOXARIFE") return canAccessBranch(activeUser, branchId);
  return false;
};
