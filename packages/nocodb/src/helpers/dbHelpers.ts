import { type NcContext, RelationTypes } from 'nocodb-sdk';
import type CustomKnex from 'src/db/CustomKnex';
import type { Knex } from 'knex';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import {
  type Column,
  type LinkToAnotherRecordColumn,
  Model,
  Source,
} from '~/models';
import { NcError } from '~/helpers/catchError';

export function concatKnexRaw(knex: CustomKnex, raws: Knex.Raw[]) {
  return knex.raw(raws.map(() => '?').join(' '), raws);
}

export function _wherePk(
  primaryKeys: Column[],
  id: unknown | unknown[],
  skipPkValidation = false,
) {
  const where = {};

  // if id object is provided use as it is
  if (id && typeof id === 'object' && !Array.isArray(id)) {
    // verify all pk columns are present in id object
    for (const pk of primaryKeys) {
      let key: string;
      if (pk.id in id) {
        key = pk.id;
      } else if (pk.title in id) {
        key = pk.title;
      } else if (pk.column_name in id) {
        key = pk.column_name;
      } else {
        NcError.badRequest(
          `Primary key column ${pk.title} not found in id object`,
        );
      }
      where[pk.column_name] = id[key];
      // validate value if auto-increment column
      // todo: add more validation based on column constraints
      if (!skipPkValidation && pk.ai && !/^\d+$/.test(id[key])) {
        NcError.invalidPrimaryKey(id[key], pk.title);
      }
    }

    return where;
  }

  let ids = id;

  if (Array.isArray(id)) {
    ids = id;
  } else if (primaryKeys.length === 1) {
    ids = [id];
  } else {
    ids = (id + '').split('___').map((val) => val.replaceAll('\\_', '_'));
  }

  for (let i = 0; i < primaryKeys.length; ++i) {
    if (primaryKeys[i].dt === 'bytea') {
      // if column is bytea, then we need to encode the id to hex based on format
      // where[primaryKeys[i].column_name] =
      // (primaryKeys[i].meta?.format === 'hex' ? '\\x' : '') + ids[i];
      return (qb) => {
        qb.whereRaw(
          `?? = decode(?, '${
            primaryKeys[i].meta?.format === 'hex' ? 'hex' : 'escape'
          }')`,
          [primaryKeys[i].column_name, ids[i]],
        );
      };
    }

    // Cast the id to string.
    const idAsString = ids[i] + '';
    // Check if the id is a UUID and the column is binary(16)
    const isUUIDBinary16 =
      primaryKeys[i].ct === 'binary(16)' &&
      (idAsString.length === 36 || idAsString.length === 32);
    // If the id is a UUID and the column is binary(16), convert the id to a Buffer. Otherwise, return null to indicate that the id is not a UUID.
    const idAsUUID = isUUIDBinary16
      ? idAsString.length === 32
        ? idAsString.replace(
            /(.{8})(.{4})(.{4})(.{4})(.{12})/,
            '$1-$2-$3-$4-$5',
          )
        : idAsString
      : null;

    where[primaryKeys[i].column_name] = idAsUUID
      ? Buffer.from(idAsUUID.replace(/-/g, ''), 'hex')
      : ids[i];
  }
  return where;
}

export function getCompositePkValue(primaryKeys: Column[], row) {
  if (row === null || row === undefined) {
    NcError.requiredFieldMissing(primaryKeys.map((c) => c.title).join(','));
  }

  if (typeof row !== 'object') return row;

  if (primaryKeys.length > 1) {
    return primaryKeys
      .map((c) =>
        (row[c.title] ?? row[c.column_name])
          ?.toString?.()
          .replaceAll('_', '\\_'),
      )
      .join('___');
  }

  return (
    primaryKeys[0] &&
    (row[primaryKeys[0].title] ?? row[primaryKeys[0].column_name])
  );
}

export function getOppositeRelationType(
  type: RelationTypes | LinkToAnotherRecordColumn['type'],
) {
  if (type === RelationTypes.HAS_MANY) {
    return RelationTypes.BELONGS_TO;
  } else if (type === RelationTypes.BELONGS_TO) {
    return RelationTypes.HAS_MANY;
  }
  return type as RelationTypes;
}

export async function getBaseModelSqlFromModelId({
  modelId,
  context,
}: {
  context: NcContext;
  modelId: string;
}) {
  const model = await Model.get(context, modelId);
  const source = await Source.get(context, model.source_id);
  return await Model.getBaseModelSQL(context, {
    id: model.id,
    dbDriver: await NcConnectionMgrv2.get(source),
    source,
  });
}

// Audit logging is enabled by default unless explicitly disabled.
// It remains enabled in the following cases:
// 1. `NC_ENABLE_AUDIT` is set to 'true' (manual override).
// 2. Running in a test environment (`NODE_ENV === 'test'`).
export function isDataAuditEnabled() {
  return (
    process.env.NC_DISABLE_AUDIT !== 'true' &&
    (process.env.NC_ENABLE_AUDIT === 'true' || process.env.NODE_ENV === 'test')
  );
}

export function getRelatedLinksColumn(
  column: Column<LinkToAnotherRecordColumn>,
  relatedModel: Model,
) {
  return relatedModel.columns.find((c: Column) => {
    if (column.colOptions?.type === RelationTypes.MANY_TO_MANY) {
      return (
        column.colOptions.fk_mm_child_column_id ===
          c.colOptions?.fk_mm_parent_column_id &&
        column.colOptions.fk_mm_parent_column_id ===
          c.colOptions?.fk_mm_child_column_id
      );
    } else {
      return (
        column.colOptions.fk_child_column_id ===
          c.colOptions?.fk_child_column_id &&
        column.colOptions.fk_parent_column_id ===
          c.colOptions?.fk_parent_column_id
      );
    }
  });
}

export function extractIdPropIfObjectOrReturn(id: any, prop: string) {
  return typeof id === 'object' ? id[prop] : id;
}
