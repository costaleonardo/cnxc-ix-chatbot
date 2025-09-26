/**
 * Hello Chatbot - Admin JavaScript
 * Handles settings page interactions
 */

(function($) {
    'use strict';
    
    $(document).ready(function() {
        
        // Test API Connection
        $('#test-connection').on('click', function(e) {
            e.preventDefault();
            testConnection();
        });
        
        // Auto-resize textarea
        $('#chatbot_welcome_message').on('input', function() {
            autoResizeTextarea(this);
        }).trigger('input');
        
        // Show/hide settings based on enabled state
        $('#chatbot_enabled').on('change', function() {
            toggleSettings();
        }).trigger('change');
        
    });
    
    function toggleSettings() {
        const isEnabled = $('#chatbot_enabled').is(':checked');
        const $settings = $('.form-table tr').not(':first');
        
        if (isEnabled) {
            $settings.fadeIn();
        } else {
            $settings.fadeOut();
        }
    }
    
    function testConnection() {
        const $button = $('#test-connection');
        const $result = $('#test-result');
        
        // Show loading
        $button.prop('disabled', true).text('Testing...');
        $result.text('').removeClass('success error');
        
        // Make AJAX request
        $.ajax({
            url: helloChatbotAdmin.ajaxUrl,
            type: 'POST',
            data: {
                action: 'hello_chatbot_test_connection',
                nonce: helloChatbotAdmin.nonce
            },
            timeout: 15000,
            success: function(response) {
                if (response.success) {
                    $result
                        .addClass('success')
                        .text(' ✓ ' + response.data)
                        .css('color', 'green');
                } else {
                    $result
                        .addClass('error')
                        .text(' ✗ ' + (response.data || 'Connection failed'))
                        .css('color', 'red');
                }
            },
            error: function(xhr, status, error) {
                let message = 'Connection failed';
                
                if (status === 'timeout') {
                    message = 'Connection timeout';
                } else if (xhr.responseJSON && xhr.responseJSON.data) {
                    message = xhr.responseJSON.data;
                }
                
                $result
                    .addClass('error')
                    .text(' ✗ ' + message)
                    .css('color', 'red');
            },
            complete: function() {
                $button.prop('disabled', false).text('Test Connection');
                
                // Auto-hide result after 5 seconds
                setTimeout(function() {
                    $result.fadeOut();
                }, 5000);
            }
        });
    }
    
    function autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight + 2) + 'px';
    }
    
})(jQuery);