# Backups locales de Postgres (Render)

## Script listo para usar
- Archivo: `scripts/backup/pg_backup_local.sh`
- Requiere: `pg_dump` disponible en PATH.
- Variables necesarias: `PGHOST`, `PGPORT` (opcional, default 5432), `PGUSER`, `PGPASSWORD`, `PGDATABASE`.
- Uso:
  ```bash
  export PGHOST="dpg-....render.com"
  export PGPORT="5432"
  export PGUSER="freia_postgres_user"
  export PGPASSWORD="********"
  export PGDATABASE="freia_postgres"

  ./scripts/backup/pg_backup_local.sh ~/db-backups
  ```
- Resultado: dump comprimido en formato custom (`*.dump`) dentro del directorio indicado. El nombre incluye timestamp.

## Restaurar (ejemplo)
```bash
pg_restore -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d nueva_db -c /ruta/al/pg-backup-*.dump
```

## Recomendaciones
- Ejecutar con cron/systemd timer en una máquina controlada (no en el mismo clúster de producción).
- Mantener permisos de archivo mínimos y, si es sensible, cifrar con `age` o `gpg` antes de almacenar.
- Probar una restauración completa en staging al menos 1 vez por mes.
