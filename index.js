function genErrorMsg(value, field, type) {
  return `Type (${value}) for field '${field}' is not valid to Type: ${type.toString().split('()')[0].slice(9)}`;
}

const whiteListSchemaKeys = ['type', 'required', 'default', 'min', 'max', 'enum'];

class Nsql {
  constructor(Schema, Model) {
    this.Schema = Schema;
    this.Model = Model;
  }
  getValid(data) {
    const toReturn = {};
    for (const key in this.Schema) {
      if (typeof this.Schema[key] == 'function') {
        if (typeof data[key] == typeof this.Schema[key]()) toReturn[key] = data[key];
        else throw genErrorMsg(data[key], key, this.Schema[key]);
      } else {
        if (!Array.isArray(this.Schema[key])) {
          //   if (!whiteListSchemaKeys.includes()) throw 'Currenlty Flat documents are supported';
          if (!data[key]) {
            if (this.Schema[key].default) toReturn[key] = this.Schema[key].default;
            else if (this.Schema[key].required) throw `Field ${key} is required`;
          } else {
            const type = this.Schema[key].type || String;
            if (typeof data[key] !== typeof type()) throw genErrorMsg(data[key], key, type);
            if (
              typeof data[key] == 'string' &&
              this.Schema[key].enum?.length &&
              !this.Schema[key].enum.includes(data[key])
            ) {
              throw `Value (${data[key]}) for field '${key}' should be within ${this.Schema[key].enum}`;
            }
            if (typeof data[key] == 'number') {
              if (this.Schema[key].min && this.Schema[key].min > data[key]) {
                throw `Value (${data[key]}) for field '${key}' should be more then ${this.Schema[key].min}`;
              }
              if (this.Schema[key].max && this.Schema[key].max < data[key]) {
                throw `Value (${data[key]}) for field '${key}' should be less then ${this.Schema[key].max}`;
              }
            }
            toReturn[key] = data[key];
          }
        }
      }
    }

    return toReturn;
  }
  create(data) {
    if (Array.isArray(data)) throw 'Create method did not accept array. Use insertMany method instead';
    data = this.getValid(data);
    return `INSERT INTO ${this.Model} (${Object.keys(data)}) VALUES (${Object.values(data).map((e) =>
      typeof e != 'string' ? e : `'${e}'`
    )})`;
  }
  inserMany(datas) {
    if (!Array.isArray(datas)) throw 'inserMany method need array. Use create method instead';
    const keys = Object.keys(datas[0]);
    const values = [];

    for (const data of datas) {
      const val = [];
      for (const k of keys) {
        let v = data[k];
        typeof data[k] == 'string' && (v = `'${data[k]}'`)
        val.push(v);
      }
      values.push(`(${val})`);
    }
    return `INSERT INTO ${this.Model} (${keys}) VALUES ${values}`
  }
  getValidProjectionFeild(selectQuery = []) {
    if (typeof selectQuery == 'string') {
      selectQuery = selectQuery.split(' ');
    }
    if (!selectQuery.length) return ['*'];
    const allKeys = Object.keys(this.Schema);
    const intrusion = [];
    const extrusion = [];
    for (const e of selectQuery) {
      if (e.startsWith('-')) extrusion.push(e.slice(1));
      else intrusion.push(e);
    }
    if (intrusion.length && extrusion.length) throw 'Projection Field can not be a mix of intrusion and extrusion';
    if (intrusion.length) return intrusion;
    const keyObjectMap = {};
    for (const k of allKeys) {
      keyObjectMap[k] = 1;
    }
    for (const d of extrusion) {
      delete keyObjectMap[d];
    }
    return Object.keys(keyObjectMap);
  }

  getValidWhereQuery(whereQuery = {}, q = '', opr = 'AND') {
    let toReturn = '';
    for (const key in whereQuery) {
      if (['$or', '$and'].includes(key)) {
        if (whereQuery[key].length < 2) throw `Atleast 2 nodes are required for ${key} operation`;
        const qq = whereQuery[key].map((e) => this.getValidWhereQuery(e, '', '')).join(` ${key.slice(1)} `);
        toReturn += ` AND (${qq})`;
      } else {
        if (typeof whereQuery[key] !== 'object') {
          let value = whereQuery[key];
          if (typeof value == 'string') value = `'${value}'`;
          q += ` ${opr} ${key} = ${value}`;
        } else {
          const opMap = {
            $gte: '>=',
            $gt: '>',
            $lte: '<=',
            $lt: '<',
            $eq: '=',
            $in: 'IN',
            $nin: 'NIN',
            $reg: 'LIKE',
          };
          for (const op in whereQuery[key]) {
            let value = whereQuery[key][op];
            if (!['$in', '$nin'].includes(op)) {
              if (typeof value == 'string') value = `'${value}'`;
            } else {
              if (typeof value[0] == 'string') value = value.map((e) => `'${e}'`);
              value = `(${value})`;
            }
            q += ` ${opr} ${key} ${opMap[op]} ${value}`;
          }
        }
        toReturn += q;
      }
    }
    return toReturn;
  }

  findOne(whereQuery, selectQuery) {
    this.find(whereQuery, selectQuery);
    this.sql += ' LIMIT 1';
    return this;
  }

  find(whereQuery, selectQuery) {
    const fields = this.getValidProjectionFeild(selectQuery);
    let sql = `SELECT ${fields.join()} FROM ${this.Model}`;
    if (whereQuery) {
      sql += ` WHERE 1=1 ${this.getValidWhereQuery(whereQuery)}`;
    }
    this.sql = sql;
    return this;
  }
  limit(limit) {
    this.sql += limit ? ` LIMIT ${limit}` : '';
    return this;
  }
  exec() {
    return this.sql.replace(/\s\s+/g, ' ');
  }
}

module.exports = Nsql;
