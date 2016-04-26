module Autotune
  # Base class for all the controllers
  class ApplicationController < ActionController::Base
    # Prevent CSRF attacks by raising an exception.
    # For APIs, you may want to use :null_session instead.
    # protect_from_forgery with: :exception

    before_action :require_login, :except => [:cors_preflight_check]

    before_action :cors_set_access_control_headers

    helper_method :current_user, :signed_in?, :omniauth_path, :login_path, :role?

    def self.model(klass = nil)
      return @model if klass.nil?
      @model = klass
    end

    def model
      self.class.model
    end

    def instance
      return nil unless model
      @instance ||= begin
        if params[:id] =~ /^\d+$/
          model.find params[:id]
        elsif params.key?(:id) && !params[:id].empty?
          model.find_by! :slug => params[:id]
        else
          model.new
        end
      end
    end

    # For all responses, return the CORS access control headers.
    def cors_set_access_control_headers
      headers['Access-Control-Allow-Origin'] = '*'
      headers['Access-Control-Allow-Methods'] = 'POST, GET, PUT, OPTIONS'
      headers['Access-Control-Allow-Headers'] = 'accept, authorization, x-requested-with, content-type'
      headers['Access-Control-Max-Age'] = '1728000'
    end

    # If this is a preflight OPTIONS request, return a blank response
    # (control headers will be included).
    def cors_preflight_check
      render :text => '', :content_type => 'text/plain'
    end

    def current_user
      @current_user ||=
        if session[:api_key].present?
          User.find_by_api_key(session[:api_key])
        elsif request.headers['Authorization'].present?
          if request.headers['Authorization'] =~ AUTH_KEY_RE
            # $~ is the match object from the last regex ^
            User.find_by_api_key($~[1])
          elsif Autotune.config.verify_authorization_header.is_a?(Proc)
            Autotune.config.verify_authorization_header.call(
              request.headers['Authorization'])
          end
        end
    end

    protected

    def omniauth_path(provider, origin = nil)
      path = "/auth/#{provider}"
      path += "?origin=#{CGI.escape(origin)}" unless origin.blank?
      path
    end

    def login_path(origin = nil)
      omniauth_path(Rails.configuration.omniauth_preferred_provider, origin)
    end

    def signed_in?
      current_user.present?
    end

    def has_google_auth?
      gauth = current_user.authorizations.find_by(:provider => 'google_oauth2')
      gauth.present? && gauth.valid_credentials?
    end

    def any_roles?
      current_user.meta['roles'].present? && current_user.meta['roles'].any?
    end

    def role?(*args)
      args.reduce { |a, e| a || current_user.meta['roles'].include?(e.to_s) }
    end

    private

    def select_from_post(*args)
      request.POST.select { |k, _| args.include? k.to_sym }
    end

    def select_from_get(*args)
      request.GET.select { |k, _| args.include? k.to_sym }
    end

    def require_login
      if signed_in? && any_roles?
        if Autotune.configuration.google_auth_enabled
          return require_google_login
        end
        return true
      end

      if signed_in?
        render_error 'Not allowed', :forbidden
      else
        respond_to do |format|
          format.html { redirect_to login_path(request.fullpath) }
          format.json { render_error 'Unauthorized', :unauthorized }
        end
      end
    end

    def require_google_login
      return true if has_google_auth?

      respond_to do |format|
        format.html { render 'google_auth' }
        format.json { render_error 'Unauthorized', :unauthorized }
      end
    end

    def require_superuser
      require_role :superuser
    end

    def require_role(*args)
      return true if signed_in? && current_user.role?(*args)
      respond_to do |format|
        format.html { redirect_to login_path }
        format.json { render_error 'Not allowed', :forbidden }
      end
    end

    def respond_to_html
      # It appears Rails automatically assumes you want HTML if html or */*
      # is anywhere in the Accept header. This is not how the Accept header is
      # supposed to work.
      if Mime[:json].in?(request.accepts)
        # We'll be lazy and assume the client wants JSON if application/json
        # appears in the Accept header. Then we have to force the format.
        request.format = :json
      else
        respond_to do |format|
          format.html { render 'index' }
        end
      end
    end

    def render_error(message, status = :internal_server_error)
      respond_to do |format|
        format.json { render(:error, :locals => { :message => message }, :status => status) }
        format.html { render(:error, :locals => { :message => message }, :status => status) }
      end
    end

    def render_accepted(message = 'accepted')
      respond_to do |format|
        format.json { render(:accepted, :locals => { :message => message }, :status => :accepted) }
        format.html { render(:accepted, :locals => { :message => message }, :status => :accepted) }
      end
    end
  end
end
