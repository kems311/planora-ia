export type ProjectRole = 'owner' | 'team' | 'client'
export type TaskStatus = 'a_faire' | 'en_cours' | 'bloque' | 'termine'

export interface Profile {
  id: string
  nom_complet: string | null
  email: string
}

export interface Project {
  id: string
  owner_id: string
  nom: string
  adresse: string | null
  date_debut: string
  client_nom: string | null
  date_fin_prevue: string | null
  avancement_global: number
  created_at: string
}

export interface Task {
  id: string
  project_id: string
  parent_id: string | null
  nom: string
  duree_jours: number
  responsable_id: string | null
  statut: TaskStatus
  avancement: number
  date_debut_calculee: string | null
  date_fin_calculee: string | null
  est_critique: boolean
  marge_jours: number
  created_at: string
  profiles?: Pick<Profile, 'nom_complet' | 'email'> | null
}

export interface TaskDependency {
  task_id: string
  predecessor_id: string
}
