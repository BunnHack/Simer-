// Event system for game engine
export class EventSystem {
    constructor() {
        this.listeners = new Map();
        this.queuedEvents = [];
    }
    
    /**
     * Subscribe to an event
     * @param {string} eventName - The name of the event to listen for
     * @param {function} callback - The function to call when the event fires
     * @param {any} context - Optional context to bind the callback to
     * @return {object} Subscription object with remove method
     */
    on(eventName, callback, context = null) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }
        
        const listener = { callback, context };
        this.listeners.get(eventName).push(listener);
        
        // Return subscription object
        return {
            remove: () => this.off(eventName, callback, context)
        };
    }
    
    /**
     * Subscribe to an event, but only trigger once
     * @param {string} eventName - The name of the event to listen for
     * @param {function} callback - The function to call when the event fires
     * @param {any} context - Optional context to bind the callback to
     * @return {object} Subscription object with remove method
     */
    once(eventName, callback, context = null) {
        const onceWrapper = (...args) => {
            this.off(eventName, onceWrapper, context);
            return callback.apply(context, args);
        };
        
        return this.on(eventName, onceWrapper, context);
    }
    
    /**
     * Unsubscribe from an event
     * @param {string} eventName - The name of the event to stop listening for
     * @param {function} callback - The callback to remove
     * @param {any} context - The context that was used when subscribing
     */
    off(eventName, callback, context = null) {
        if (!this.listeners.has(eventName)) return;
        
        const listeners = this.listeners.get(eventName);
        const remainingListeners = listeners.filter(listener => 
            listener.callback !== callback || listener.context !== context
        );
        
        if (remainingListeners.length === 0) {
            this.listeners.delete(eventName);
        } else {
            this.listeners.set(eventName, remainingListeners);
        }
    }
    
    /**
     * Clear all listeners for an event, or all events if no event name is provided
     * @param {string} eventName - Optional event name to clear listeners for
     */
    clear(eventName = null) {
        if (eventName) {
            this.listeners.delete(eventName);
        } else {
            this.listeners.clear();
        }
    }
    
    /**
     * Emit an event immediately
     * @param {string} eventName - The name of the event to emit
     * @param {object} data - Data to pass to the event listeners
     */
    emit(eventName, data = {}) {
        if (!this.listeners.has(eventName)) return;
        
        const listeners = this.listeners.get(eventName);
        for (const listener of listeners) {
            try {
                listener.callback.call(listener.context, data);
            } catch (error) {
                console.error(`Error in event listener for "${eventName}":`, error);
            }
        }
    }
    
    /**
     * Queue an event to be emitted on the next update
     * @param {string} eventName - The name of the event to emit
     * @param {object} data - Data to pass to the event listeners
     */
    queue(eventName, data = {}) {
        this.queuedEvents.push({ eventName, data });
    }
    
    /**
     * Emit all queued events and clear the queue
     */
    processQueue() {
        const queuedEvents = [...this.queuedEvents];
        this.queuedEvents = [];
        
        for (const event of queuedEvents) {
            this.emit(event.eventName, event.data);
        }
    }
}