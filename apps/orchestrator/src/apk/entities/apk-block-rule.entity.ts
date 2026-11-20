import { Column, Entity, PrimaryColumn } from 'typeorm';

export const apkBlockScopes = ['sha256', 'package'] as const;
export type ApkBlockScope = (typeof apkBlockScopes)[number];

@Entity({ name: 'apk_block_rules' })
export class ApkBlockRule {
  @PrimaryColumn({ type: 'text' })
  scope!: ApkBlockScope;

  @PrimaryColumn({ type: 'text' })
  value!: string;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'text' })
  originalName!: string;

  @Column({ type: 'text', nullable: true })
  packageName!: string | null;
}
