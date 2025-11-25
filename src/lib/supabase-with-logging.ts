import { supabase } from "@/integrations/supabase/client";
import { logDatabaseOperation, logger } from "./logger";

/**
 * Wrapper around Supabase client that automatically logs database errors
 */
export const createLoggedQuery = () => {
  const originalFrom = supabase.from.bind(supabase);
  
  // Create a proxy to intercept supabase.from() calls
  return new Proxy(supabase, {
    get(target, prop) {
      if (prop === 'from') {
        return (table: string) => {
          const queryBuilder = originalFrom(table);
          
          // Wrap select, insert, update, delete operations
          const wrapOperation = (operation: string, originalMethod: any) => {
            return function(this: any, ...args: any[]) {
              const startTime = Date.now();
              const result = originalMethod.apply(this, args);
              
              // If it returns a promise, wrap it
              if (result && typeof result.then === 'function') {
                return result.then(
                  (response: any) => {
                    const duration = Date.now() - startTime;
                    if (response.error) {
                      logDatabaseOperation(operation, table, false, duration, response.error);
                    } else {
                      logDatabaseOperation(operation, table, true, duration);
                    }
                    return response;
                  },
                  (error: any) => {
                    const duration = Date.now() - startTime;
                    logDatabaseOperation(operation, table, false, duration, error);
                    throw error;
                  }
                );
              }
              
              return result;
            };
          };
          
          // Wrap methods that can have errors
          ['select', 'insert', 'update', 'delete', 'upsert'].forEach(method => {
            if (typeof queryBuilder[method] === 'function') {
              const original = queryBuilder[method];
              queryBuilder[method] = wrapOperation(method, original);
            }
          });
          
          return queryBuilder;
        };
      }
      
      return target[prop as keyof typeof target];
    }
  });
};










