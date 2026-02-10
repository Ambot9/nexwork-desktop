import Store from 'electron-store'
import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'

// Schema interfaces
interface AppSettings {
  theme: string
  notificationSounds: boolean
  selectedSound: string
  startOnStartup: boolean
  aiEnabled: boolean
  aiProvider: string
  aiApiKey: string
  aiModel: string
  lastWorkspace: string
  windowBounds: {
    width: number
    height: number
    x?: number
    y?: number
  }
}

interface FeatureRecord {
  id: string
  name: string
  status: 'active' | 'completed' | 'deleted'
  createdAt: string
  completedAt?: string
  deletedAt?: string
  projectCount: number
  template: string
  metadata: string // JSON string
}

interface ActivityRecord {
  id: string
  type: 'create' | 'update' | 'delete' | 'complete' | 'push' | 'pull'
  featureName: string
  projectName?: string
  timestamp: string
  details: string
}

class StorageService {
  private settingsStore: Store<AppSettings>
  private db: Database.Database | null = null
  private dbPath: string

  constructor() {
    // Initialize electron-store for settings
    this.settingsStore = new Store<AppSettings>({
      name: 'nexwork-settings',
      defaults: {
        theme: 'dark',
        notificationSounds: true,
        selectedSound: 'codeComplete',
        startOnStartup: false,
        aiEnabled: false,
        aiProvider: 'claude',
        aiApiKey: '',
        aiModel: 'claude-3-5-sonnet-20241022',
        lastWorkspace: '',
        windowBounds: {
          width: 1200,
          height: 800
        }
      }
    })

    // Set up database path in user data directory
    this.dbPath = path.join(app.getPath('userData'), 'nexwork-data.db')
    this.initDatabase()
  }

  // Initialize SQLite database
  private initDatabase(): void {
    try {
      this.db = new Database(this.dbPath)
      
      // Create features table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS features (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          status TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          completedAt TEXT,
          deletedAt TEXT,
          projectCount INTEGER DEFAULT 0,
          template TEXT,
          metadata TEXT
        )
      `)

      // Create activity log table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS activity_log (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          featureName TEXT NOT NULL,
          projectName TEXT,
          timestamp TEXT NOT NULL,
          details TEXT
        )
      `)

      // Create indexes for performance
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_features_status ON features(status);
        CREATE INDEX IF NOT EXISTS idx_features_created ON features(createdAt);
        CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_log(timestamp);
        CREATE INDEX IF NOT EXISTS idx_activity_feature ON activity_log(featureName);
      `)

      console.log('✅ Database initialized at:', this.dbPath)
    } catch (error) {
      console.error('❌ Failed to initialize database:', error)
    }
  }

  // ==================== SETTINGS METHODS ====================

  getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.settingsStore.get(key)
  }

  setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.settingsStore.set(key, value)
  }

  getAllSettings(): AppSettings {
    return this.settingsStore.store
  }

  resetSettings(): void {
    this.settingsStore.clear()
  }

  // ==================== FEATURES METHODS ====================

  saveFeature(feature: Omit<FeatureRecord, 'id'> & { id?: string }): FeatureRecord {
    if (!this.db) throw new Error('Database not initialized')

    const id = feature.id || `feat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO features 
      (id, name, status, createdAt, completedAt, deletedAt, projectCount, template, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      feature.name,
      feature.status,
      feature.createdAt,
      feature.completedAt || null,
      feature.deletedAt || null,
      feature.projectCount,
      feature.template || 'default',
      JSON.stringify(feature.metadata || {})
    )

    return { ...feature, id } as FeatureRecord
  }

  getFeature(id: string): FeatureRecord | null {
    if (!this.db) return null

    const stmt = this.db.prepare('SELECT * FROM features WHERE id = ?')
    const row = stmt.get(id) as any
    
    if (!row) return null
    
    return {
      ...row,
      metadata: JSON.parse(row.metadata || '{}')
    }
  }

  getAllFeatures(status?: 'active' | 'completed' | 'deleted'): FeatureRecord[] {
    if (!this.db) return []

    let query = 'SELECT * FROM features'
    if (status) {
      query += ' WHERE status = ? ORDER BY createdAt DESC'
    } else {
      query += ' ORDER BY createdAt DESC'
    }

    const stmt = this.db.prepare(query)
    const rows = status ? stmt.all(status) : stmt.all()
    
    return rows.map((row: any) => ({
      ...row,
      metadata: JSON.parse(row.metadata || '{}')
    }))
  }

  getActiveFeatures(): FeatureRecord[] {
    return this.getAllFeatures('active')
  }

  getCompletedFeatures(): FeatureRecord[] {
    return this.getAllFeatures('completed')
  }

  updateFeatureStatus(id: string, status: 'active' | 'completed' | 'deleted'): void {
    if (!this.db) return

    const updates: any = { status }
    
    if (status === 'completed') {
      updates.completedAt = new Date().toISOString()
    } else if (status === 'deleted') {
      updates.deletedAt = new Date().toISOString()
    }

    const setClause = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ')
    
    const stmt = this.db.prepare(`
      UPDATE features SET ${setClause} WHERE id = ?
    `)
    
    stmt.run(...Object.values(updates), id)
  }

  deleteFeaturePermanently(id: string): void {
    if (!this.db) return
    
    const stmt = this.db.prepare('DELETE FROM features WHERE id = ?')
    stmt.run(id)
  }

  // ==================== ACTIVITY LOG METHODS ====================

  logActivity(activity: Omit<ActivityRecord, 'id' | 'timestamp'>): ActivityRecord {
    if (!this.db) throw new Error('Database not initialized')

    const id = `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const timestamp = new Date().toISOString()

    const stmt = this.db.prepare(`
      INSERT INTO activity_log (id, type, featureName, projectName, timestamp, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      activity.type,
      activity.featureName,
      activity.projectName || null,
      timestamp,
      activity.details || ''
    )

    return { ...activity, id, timestamp }
  }

  getActivityLog(featureName?: string, limit: number = 100): ActivityRecord[] {
    if (!this.db) return []

    let query = 'SELECT * FROM activity_log'
    const params: any[] = []

    if (featureName) {
      query += ' WHERE featureName = ?'
      params.push(featureName)
    }

    query += ' ORDER BY timestamp DESC LIMIT ?'
    params.push(limit)

    const stmt = this.db.prepare(query)
    return stmt.all(...params) as ActivityRecord[]
  }

  getRecentActivity(hours: number = 24): ActivityRecord[] {
    if (!this.db) return []

    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
    
    const stmt = this.db.prepare(`
      SELECT * FROM activity_log 
      WHERE timestamp > ? 
      ORDER BY timestamp DESC
    `)
    
    return stmt.all(since) as ActivityRecord[]
  }

  // ==================== STATISTICS ====================

  getStats(): {
    totalFeatures: number
    activeFeatures: number
    completedFeatures: number
    totalProjects: number
    recentActivity: number
  } {
    if (!this.db) {
      return {
        totalFeatures: 0,
        activeFeatures: 0,
        completedFeatures: 0,
        totalProjects: 0,
        recentActivity: 0
      }
    }

    const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM features')
    const activeStmt = this.db.prepare("SELECT COUNT(*) as count FROM features WHERE status = 'active'")
    const completedStmt = this.db.prepare("SELECT COUNT(*) as count FROM features WHERE status = 'completed'")
    const projectsStmt = this.db.prepare('SELECT SUM(projectCount) as count FROM features')
    
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const recentStmt = this.db.prepare('SELECT COUNT(*) as count FROM activity_log WHERE timestamp > ?')

    return {
      totalFeatures: (totalStmt.get() as any).count,
      activeFeatures: (activeStmt.get() as any).count,
      completedFeatures: (completedStmt.get() as any).count,
      totalProjects: (projectsStmt.get() as any).count || 0,
      recentActivity: (recentStmt.get(since) as any).count
    }
  }

  // ==================== UTILITY ====================

  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }

  getDatabasePath(): string {
    return this.dbPath
  }

  // Backup database
  backup(backupPath?: string): string {
    if (!this.db) throw new Error('Database not initialized')
    
    const path = backupPath || `${this.dbPath}.backup-${Date.now()}`
    this.db.backup(path)
    return path
  }
}

// Export singleton instance
export const storage = new StorageService()
export type { AppSettings, FeatureRecord, ActivityRecord }
