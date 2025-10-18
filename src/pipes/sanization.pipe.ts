import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import * as sanitizeHtml from 'sanitize-html';

@Injectable()
export class SanitizationPipe implements PipeTransform {
  private readonly defaultOptions: sanitizeHtml.IOptions = {
    allowedTags: [],
    allowedAttributes: {},
  };

  constructor(
    private readonly options: sanitizeHtml.IOptions = this.defaultOptions,
  ) {}

  transform(value: any, metadata: ArgumentMetadata) {
    if (
      metadata.type === 'body' ||
      metadata.type === 'query' ||
      metadata.type === 'param'
    ) {
      if (typeof value === 'string') {
        return sanitizeHtml(value, this.options);
      }

      if (typeof value === 'object' && value !== null) {
        return this.sanitizeObject(value);
      }
    }

    return value;
  }

  private sanitizeObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    const sanitizedObj = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        if (typeof value === 'string') {
          sanitizedObj[key] = sanitizeHtml(value, this.options);
        } else if (typeof value === 'object' && value !== null) {
          sanitizedObj[key] = this.sanitizeObject(value);
        } else {
          sanitizedObj[key] = value;
        }
      }
    }
    return sanitizedObj;
  }
}
